import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type Redis from "ioredis";
import { z } from "zod";
import type { MusicTrackDto } from "@/lib/api-types";
import { cleanFileName, MAX_MUSIC_BYTES, sniffAudio } from "@/server/audio-file";
import type { Db, DbOrTx } from "@/server/db";
import { musicTracks } from "@/server/db/schema";
import { NotFoundError, RateLimitedError, TooLargeError, ValidationError } from "@/server/errors";
import { signMediaPath } from "@/server/media-url";
import { hit, scaled } from "@/server/rate-limit";
import { FetchRefused, safeFetch, type SafeFetchOptions } from "@/server/safe-fetch";
import { cleanupAfterCommit, deleteObjects, keys, putObject, type Storage } from "@/server/storage";

// The user's background-music library. Files are checked by their content (MP3 or WAV), stored
// privately and played back through short-lived signed links.

export const MAX_TRACKS_PER_USER = 50;
/** Uploads + imports per user per hour (multiplied by AUTH_RATE_LIMIT_SCALE). */
export const MUSIC_LIMIT = { max: 30, windowSec: 60 * 60 };

export type MusicDeps = { db: Db; storage: Storage; redis: Redis; secret: string; rateLimitScale?: number };

function toDto(row: typeof musicTracks.$inferSelect, secret: string): MusicTrackDto {
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    sourceUrl: row.sourceUrl,
    sizeBytes: row.sizeBytes,
    mimeType: row.mimeType,
    createdAt: row.createdAt.toISOString(),
    url: signMediaPath(secret, row.storageKey),
  };
}

async function guard(deps: MusicDeps, userId: string) {
  const limit = await hit(deps.redis, `rl:music:user:${userId}`, scaled(MUSIC_LIMIT, deps.rateLimitScale ?? 1));
  if (limit.blocked) throw new RateLimitedError("Too many uploads. Please try again later.");
  const [{ n }] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(musicTracks).where(eq(musicTracks.userId, userId));
  if (n >= MAX_TRACKS_PER_USER) throw new ValidationError(`Your library is full (${MAX_TRACKS_PER_USER} tracks). Remove a track first.`);
}

async function store(
  deps: MusicDeps,
  userId: string,
  bytes: Uint8Array,
  meta: { name: string; source: "upload" | "url"; sourceUrl?: string },
): Promise<MusicTrackDto> {
  if (bytes.length === 0) throw new ValidationError("The file is empty.");
  if (bytes.length > MAX_MUSIC_BYTES) throw new TooLargeError("The file is larger than 10 MB.");
  const kind = sniffAudio(bytes);
  if (!kind) throw new ValidationError("This isn't an MP3 or WAV file.");

  const id = randomUUID();
  const storageKey = keys.music(userId, id, kind.ext);
  await putObject(deps.storage, storageKey, bytes, kind.mime);
  try {
    const [row] = await deps.db
      .insert(musicTracks)
      .values({ id, userId, source: meta.source, name: meta.name, storageKey, sourceUrl: meta.sourceUrl, mimeType: kind.mime, sizeBytes: bytes.length })
      .returning();
    return toDto(row, deps.secret);
  } catch (e) {
    await cleanupAfterCommit(() => deleteObjects(deps.storage, [storageKey]), `music ${id} after failed insert`);
    throw e;
  }
}

/** Reads a request body up to `max` bytes; stops reading (and fails) as soon as it goes over. */
export async function readBodyLimited(body: ReadableStream<Uint8Array> | null, max: number): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw new TooLargeError("The file is larger than 10 MB.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export async function uploadMusic(deps: MusicDeps, userId: string, input: { bytes: Uint8Array; fileName: string | null }): Promise<MusicTrackDto> {
  await guard(deps, userId);
  return store(deps, userId, input.bytes, { name: cleanFileName(input.fileName, "Uploaded track"), source: "upload" });
}

const importSchema = z.object({ url: z.string().trim().min(1, "Paste a link.").max(2000) });

export async function importMusic(deps: MusicDeps, userId: string, input: unknown, fetchOptions?: Partial<SafeFetchOptions>): Promise<MusicTrackDto> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid link.");
  await guard(deps, userId);

  let fetched;
  try {
    fetched = await safeFetch(parsed.data.url, { maxBytes: MAX_MUSIC_BYTES, ...fetchOptions });
  } catch (e) {
    if (e instanceof FetchRefused) throw new ValidationError(e.message);
    throw e;
  }
  if (!sniffAudio(fetched.bytes)) {
    // The usual mistake: a page about a sound (TikTok, YouTube...) instead of the audio file itself.
    throw new ValidationError("That link isn't an MP3 or WAV file. Paste a direct link to the audio file.");
  }
  const urlName = decodeURIComponent(new URL(fetched.finalUrl).pathname.split("/").pop() || "");
  return store(deps, userId, fetched.bytes, { name: cleanFileName(urlName, "Imported track"), source: "url", sourceUrl: parsed.data.url });
}

export async function listMusic(deps: Pick<MusicDeps, "db" | "secret">, userId: string): Promise<MusicTrackDto[]> {
  const rows = await deps.db.select().from(musicTracks).where(eq(musicTracks.userId, userId)).orderBy(desc(musicTracks.createdAt));
  return rows.map((r) => toDto(r, deps.secret));
}

/** The user's tracks among `ids` (unknown or foreign ids are an error, so a series can't borrow other people's files). */
export async function ownedTrackIds(db: DbOrTx, userId: string, ids: string[]): Promise<string[]> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return [];
  if (unique.some((id) => !z.string().uuid().safeParse(id).success)) throw new ValidationError("Unknown music track.");
  const rows = await db
    .select({ id: musicTracks.id })
    .from(musicTracks)
    .where(and(eq(musicTracks.userId, userId), inArray(musicTracks.id, unique)));
  if (rows.length !== unique.length) throw new ValidationError("Unknown music track.");
  return unique;
}

export async function deleteMusic(deps: Pick<MusicDeps, "db" | "storage">, userId: string, id: string): Promise<void> {
  if (!z.string().uuid().safeParse(id).success) throw new NotFoundError("Track not found");
  const [row] = await deps.db
    .delete(musicTracks)
    .where(and(eq(musicTracks.id, id), eq(musicTracks.userId, userId)))
    .returning({ storageKey: musicTracks.storageKey });
  if (!row) throw new NotFoundError("Track not found");
  await cleanupAfterCommit(() => deleteObjects(deps.storage, [row.storageKey]), `music ${id}`);
}
