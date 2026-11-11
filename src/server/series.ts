import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";
import type { SeriesDto } from "@/lib/api-types";
import { ART_STYLES, CAPTION_STYLES, FORMATS, FREQUENCIES, type FrequencyId, LANGUAGES, PLATFORMS, VOICES } from "@/lib/options";
import type { Db, Tx } from "@/server/db";
import { series, seriesMusicTracks, videos } from "@/server/db/schema";
import { NotFoundError, ValidationError } from "@/server/errors";
import { ownedTrackIds } from "@/server/music";
import { refundQueuedVideos } from "@/server/videos";

// Series of a user. Every query filters by the owner: another user's series is "not found".

const ids = <T extends readonly { id: string }[]>(list: T) => list.map((x) => x.id) as [string, ...string[]];

/** Background tracks per series (one is picked per video). */
export const MAX_TRACKS_PER_SERIES = 10;

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const fields = {
  name: z.string().trim().min(1, "Give your series a name.").max(80),
  formats: z.array(z.enum(ids(FORMATS))).min(1, "Choose at least one format.").max(FORMATS.length),
  niche: z.string().trim().min(3, "Describe what the videos are about.").max(1000),
  language: z.enum(ids(LANGUAGES)),
  voice: z.enum(ids(VOICES)),
  artStyle: z.enum(ids(ART_STYLES)),
  captionStyle: z.enum(ids(CAPTION_STYLES)),
  platforms: z.array(z.enum(["tiktok", "instagram", "youtube"])).max(PLATFORMS.length),
  frequency: z.enum(ids(FREQUENCIES) as [FrequencyId, ...FrequencyId[]]),
  postTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the HH:MM format."),
  timezone: z.string().refine(isValidTimezone, "Unknown time zone."),
  status: z.enum(["active", "paused"]),
  musicTrackIds: z.array(z.string()).max(MAX_TRACKS_PER_SERIES, `Pick up to ${MAX_TRACKS_PER_SERIES} tracks.`),
};

export const createSeriesSchema = z.object({
  ...fields,
  platforms: fields.platforms.default([]),
  timezone: fields.timezone.optional(),
  status: fields.status.default("active"),
  musicTrackIds: fields.musicTrackIds.default([]),
});

export const updateSeriesSchema = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.");

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? "Invalid data.");
  // Duplicates in list fields (e.g. the same platform twice) are dropped.
  const data = result.data as Record<string, unknown>;
  for (const key of ["formats", "platforms", "musicTrackIds"]) if (Array.isArray(data[key])) data[key] = Array.from(new Set(data[key] as string[]));
  return data as z.infer<T>;
}

const uuid = z.string().uuid();
const checkId = (id: string) => {
  if (!uuid.safeParse(id).success) throw new NotFoundError("Series not found");
};

type Row = typeof series.$inferSelect & { videoCount: number; publishedCount: number; musicTrackIds: string[] };

function toDto(row: Row): SeriesDto {
  return {
    id: row.id,
    name: row.name,
    formats: row.formats,
    niche: row.niche,
    language: row.language,
    voice: row.voice,
    artStyle: row.artStyle,
    captionStyle: row.captionStyle,
    platforms: row.platforms,
    frequency: row.frequency,
    postTime: row.postTime,
    timezone: row.timezone,
    status: row.status,
    musicTrackIds: row.musicTrackIds,
    createdAt: row.createdAt.toISOString(),
    videoCount: row.videoCount,
    publishedCount: row.publishedCount,
  };
}

// Written with explicit table names: inside a select, Drizzle renders ${series.id} as a bare "id",
// which the subquery would resolve to the inner table's own id.
const extra = {
  videoCount: sql<number>`(select count(*)::int from videos v where v.series_id = "series"."id")`,
  publishedCount: sql<number>`(select count(*)::int from videos v where v.series_id = "series"."id" and v.status = 'published')`,
  musicTrackIds: sql<string[]>`coalesce((select array_agg(m.music_track_id::text order by m.music_track_id) from series_music_tracks m where m.series_id = "series"."id"), '{}')`,
};

export async function listSeries(db: Db, userId: string): Promise<SeriesDto[]> {
  const rows = await db
    .select({ ...getTableColumns(series), ...extra })
    .from(series)
    .where(eq(series.userId, userId))
    .orderBy(desc(series.createdAt));
  return rows.map(toDto);
}

export async function getSeries(db: Db, userId: string, id: string): Promise<SeriesDto> {
  checkId(id);
  const [row] = await db
    .select({ ...getTableColumns(series), ...extra })
    .from(series)
    .where(and(eq(series.id, id), eq(series.userId, userId)));
  if (!row) throw new NotFoundError("Series not found");
  return toDto(row);
}

/** Replaces the background music of a series with the user's own tracks `trackIds`. */
async function setSeriesMusic(tx: Tx, userId: string, seriesId: string, trackIds: string[]) {
  const owned = await ownedTrackIds(tx, userId, trackIds);
  await tx.delete(seriesMusicTracks).where(eq(seriesMusicTracks.seriesId, seriesId));
  if (owned.length) await tx.insert(seriesMusicTracks).values(owned.map((musicTrackId) => ({ seriesId, musicTrackId })));
}

/** Creates a series. Without a time zone it uses the user's. */
export async function createSeries(db: Db, userId: string, input: unknown, userTimezone = "UTC"): Promise<SeriesDto> {
  const { musicTrackIds, ...data } = parse(createSeriesSchema, input);
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(series)
      .values({ ...data, timezone: data.timezone ?? userTimezone, userId })
      .returning({ id: series.id });
    await setSeriesMusic(tx, userId, row.id, musicTrackIds);
    return row.id;
  });
  return getSeries(db, userId, id);
}

export async function updateSeries(db: Db, userId: string, id: string, input: unknown): Promise<SeriesDto> {
  checkId(id);
  const { musicTrackIds, ...data } = parse(updateSeriesSchema, input);
  await db.transaction(async (tx) => {
    const [row] = Object.keys(data).length
      ? await tx
          .update(series)
          .set(data)
          .where(and(eq(series.id, id), eq(series.userId, userId)))
          .returning({ id: series.id })
      : await tx
          .select({ id: series.id })
          .from(series)
          .where(and(eq(series.id, id), eq(series.userId, userId)));
    if (!row) throw new NotFoundError("Series not found");
    if (musicTrackIds) await setSeriesMusic(tx, userId, id, musicTrackIds);
  });
  return getSeries(db, userId, id);
}

/**
 * Deletes a series and its videos. Credits of videos still waiting in the queue are refunded.
 * Returns the ids of the deleted videos (their files are removed by the caller after commit).
 */
export async function deleteSeries(db: Db, userId: string, id: string): Promise<string[]> {
  checkId(id);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: series.id })
      .from(series)
      .where(and(eq(series.id, id), eq(series.userId, userId)))
      .for("update");
    if (!row) throw new NotFoundError("Series not found");
    await refundQueuedVideos(tx, and(eq(videos.seriesId, id), eq(videos.userId, userId))!);
    const gone = await tx.select({ id: videos.id }).from(videos).where(eq(videos.seriesId, id));
    await tx.delete(series).where(eq(series.id, id));
    return gone.map((v) => v.id);
  });
}
