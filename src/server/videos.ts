import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { VIDEO_PAGE_SIZE, type VideoDto, videoCursor } from "@/lib/api-types";
import type { Db, DbOrTx, Tx } from "@/server/db";
import { getCreditBalance } from "@/server/db/credits";
import { creditLedger, series, videos } from "@/server/db/schema";
import { InsufficientCreditsError, NotFoundError } from "@/server/errors";

// Videos of a user and the credits they cost.
// - Creating a video costs 1 credit, charged in the same transaction, under a per-user lock, so
//   simultaneous clicks can never take the balance below zero.
// - A video that fails is refunded once. A video deleted while still waiting in the queue
//   (nothing was produced yet) is refunded too.

const uuid = z.string().uuid();

function toDto(row: typeof videos.$inferSelect & { seriesName: string }): VideoDto {
  return {
    id: row.id,
    seriesId: row.seriesId,
    seriesName: row.seriesName,
    title: row.title,
    status: row.status,
    durationMs: row.durationMs,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishedUrls: row.publishedUrls ?? null,
    hasFile: Boolean(row.videoKey),
  };
}

const withSeriesName = { video: videos, seriesName: series.name };

export { VIDEO_PAGE_SIZE, videoCursor };

function parseCursor(cursor: string | undefined): { at: string; id: string } | null {
  const m = cursor?.match(/^(.+)_([0-9a-f-]{36})$/i);
  if (!m || Number.isNaN(Date.parse(m[1])) || !uuid.safeParse(m[2]).success) return null;
  return { at: new Date(m[1]).toISOString(), id: m[2] };
}

/**
 * The user's videos, newest first, one page at a time. Pass the cursor of the last video to get the
 * next page. Times are compared at millisecond precision, the precision the cursor carries.
 */
export async function listVideos(
  db: Db,
  userId: string,
  opts: { seriesId?: string; limit?: number; cursor?: string } = {},
): Promise<VideoDto[]> {
  if (opts.seriesId && !uuid.safeParse(opts.seriesId).success) return [];
  const after = parseCursor(opts.cursor);
  const createdMs = sql`date_trunc('milliseconds', ${videos.createdAt})`;
  const rows = await db
    .select(withSeriesName)
    .from(videos)
    .innerJoin(series, eq(series.id, videos.seriesId))
    .where(
      and(
        eq(videos.userId, userId),
        opts.seriesId ? eq(videos.seriesId, opts.seriesId) : undefined,
        after ? sql`(${createdMs}, ${videos.id}) < (${after.at}::timestamptz, ${after.id}::uuid)` : undefined,
      ),
    )
    .orderBy(sql`${createdMs} desc`, desc(videos.id))
    .limit(Math.max(1, Math.min(opts.limit ?? VIDEO_PAGE_SIZE, 200)));
  return rows.map((r) => toDto({ ...r.video, seriesName: r.seriesName }));
}

export async function getVideo(db: Db, userId: string, id: string): Promise<VideoDto> {
  if (!uuid.safeParse(id).success) throw new NotFoundError("Video not found");
  const [row] = await db
    .select(withSeriesName)
    .from(videos)
    .innerJoin(series, eq(series.id, videos.seriesId))
    .where(and(eq(videos.id, id), eq(videos.userId, userId)));
  if (!row) throw new NotFoundError("Video not found");
  return toDto({ ...row.video, seriesName: row.seriesName });
}

/** Serializes credit operations of one user until the transaction ends. */
async function lockUserCredits(tx: Tx, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`credits:${userId}`}, 0))`);
}

/** Charges 1 credit and creates the next video of the series, waiting in the queue. */
export async function createVideo(db: Db, userId: string, seriesId: string): Promise<VideoDto> {
  if (!uuid.safeParse(seriesId).success) throw new NotFoundError("Series not found");

  const id = await db.transaction(async (tx) => {
    await lockUserCredits(tx, userId);

    const [owned] = await tx
      .select({ name: series.name })
      .from(series)
      .where(and(eq(series.id, seriesId), eq(series.userId, userId)));
    if (!owned) throw new NotFoundError("Series not found");

    if ((await getCreditBalance(tx, userId)) < 1) throw new InsufficientCreditsError();

    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(videos).where(eq(videos.seriesId, seriesId));
    const [video] = await tx
      .insert(videos)
      .values({ seriesId, userId, title: `${owned.name} #${n + 1}`, status: "queued" })
      .returning({ id: videos.id });
    await tx.insert(creditLedger).values({ userId, delta: -1, reason: "video_debit", videoId: video.id });
    return video.id;
  });
  // The worker picks queued videos up from Passo 5 on.
  return getVideo(db, userId, id);
}

/** Gives back the credit of every charged, not yet refunded video matching `where` that is still queued. */
export async function refundQueuedVideos(tx: Tx, where: SQL): Promise<number> {
  const queued = await tx
    .select({ id: videos.id, userId: videos.userId })
    .from(videos)
    .where(
      and(
        where,
        eq(videos.status, "queued"),
        // Only videos that were actually charged.
        sql`exists (select 1 from ${creditLedger} l where l.video_id = ${videos.id} and l.reason = 'video_debit')`,
      ),
    );
  if (queued.length === 0) return 0;
  const refunded = await tx
    .insert(creditLedger)
    .values(queued.map((v) => ({ userId: v.userId, delta: 1, reason: "video_refund" as const, videoId: v.id, note: "cancelled before generation" })))
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });
  return refunded.length;
}

/**
 * Marks a video as failed and refunds its credit (at most once). Used by the worker (Passo 5).
 * Returns false when the video was already failed or published.
 */
export async function failVideo(db: DbOrTx, videoId: string, error: string): Promise<boolean> {
  const run = async (tx: Tx) => {
    const [video] = await tx
      .update(videos)
      .set({ status: "failed", error: error.slice(0, 1000) })
      .where(and(eq(videos.id, videoId), sql`${videos.status} not in ('failed', 'published')`))
      .returning({ id: videos.id, userId: videos.userId });
    if (!video) return false;
    const [debit] = await tx
      .select({ id: creditLedger.id })
      .from(creditLedger)
      .where(and(eq(creditLedger.videoId, videoId), eq(creditLedger.reason, "video_debit")));
    if (debit) {
      await tx
        .insert(creditLedger)
        .values({ userId: video.userId, delta: 1, reason: "video_refund", videoId, note: "generation failed" })
        .onConflictDoNothing();
    }
    return true;
  };
  // Inside another transaction this becomes a savepoint.
  return (db as Db).transaction(run);
}

/** Deletes a video. If it was still waiting in the queue, its credit comes back. */
export async function deleteVideo(db: Db, userId: string, id: string): Promise<{ refunded: boolean }> {
  if (!uuid.safeParse(id).success) throw new NotFoundError("Video not found");
  return db.transaction(async (tx) => {
    await lockUserCredits(tx, userId);
    const [row] = await tx
      .select({ id: videos.id })
      .from(videos)
      .where(and(eq(videos.id, id), eq(videos.userId, userId)))
      .for("update");
    if (!row) throw new NotFoundError("Video not found");
    const refunded = await refundQueuedVideos(tx, eq(videos.id, id));
    await tx.delete(videos).where(eq(videos.id, id));
    return { refunded: refunded > 0 };
  });
}