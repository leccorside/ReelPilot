import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { env } from "@/lib/env";
import type { Db } from "@/server/db";
import { getCreditBalance } from "@/server/db/credits";
import { creditLedger, users, videoSteps, videos } from "@/server/db/schema";
import { createSeries } from "@/server/series";
import { createStorage, getObject } from "@/server/storage";
import { createVideo } from "@/server/videos";

// Shared by the worker's integration tests (test database, real S3, ffmpeg in the container).

export function testStorage() {
  const e = env();
  return createStorage({ endpoint: e.S3_ENDPOINT, region: e.S3_REGION, accessKey: e.S3_ACCESS_KEY, secretKey: e.S3_SECRET_KEY, bucket: e.S3_BUCKET });
}

export async function testTmpRoot() {
  const dir = await mkdtemp(join(tmpdir(), "reelpilot-test-"));
  await mkdir(dir, { recursive: true });
  return dir;
}

/** A user with `credits`, a series and one video created (and charged) through the real API code. */
export async function newVideo(db: Db, credits = 5) {
  const [user] = await db.insert(users).values({ email: `worker-${randomUUID()}@test.dev` }).returning();
  await db.insert(creditLedger).values({ userId: user.id, delta: credits, reason: "manual_adjustment" });
  const s = await createSeries(
    db,
    user.id,
    { name: "Space facts", formats: ["facts"], niche: "Little-known facts about space", language: "en", voice: "adam", artStyle: "realism", captionStyle: "bold", frequency: "daily", postTime: "10:00" },
    "UTC",
  );
  const video = await createVideo(db, user.id, s.id);
  return { userId: user.id, seriesId: s.id, videoId: video.id };
}

export async function videoRow(db: Db, id: string) {
  const [v] = await db.select().from(videos).where(eq(videos.id, id));
  return v;
}

export async function stepRows(db: Db, id: string) {
  const rows = await db.select().from(videoSteps).where(eq(videoSteps.videoId, id));
  return Object.fromEntries(rows.map((r) => [r.step, r]));
}

/** Debits and refunds recorded for a video, and the user's balance. */
export async function credits(db: Db, userId: string, videoId: string) {
  const rows = await db.select().from(creditLedger).where(and(eq(creditLedger.userId, userId), eq(creditLedger.videoId, videoId)));
  return {
    debits: rows.filter((r) => r.reason === "video_debit").length,
    refunds: rows.filter((r) => r.reason === "video_refund").length,
    balance: await getCreditBalance(db, userId),
  };
}

/** Copies a stored object to a local file (for ffprobe). */
export async function downloadTo(key: string, dir: string, name: string) {
  const obj = await getObject(testStorage(), key);
  if (!obj?.Body) throw new Error(`missing ${key}`);
  const file = join(dir, name);
  await writeFile(file, await obj.Body.transformToByteArray());
  return file;
}

export async function waitFor<T>(what: string, fn: () => Promise<T | undefined | null | false>, timeoutMs = 30_000, everyMs = 200): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, everyMs));
  }
}
