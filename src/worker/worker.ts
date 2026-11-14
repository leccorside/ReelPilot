import { type Queue, Worker } from "bullmq";
import type Redis from "ioredis";
import { and, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import { videos } from "@/server/db/schema";
import { enqueueVideo, VIDEO_QUEUE, type VideoJobData, videoJobOptions } from "@/server/video-queue";
import { failVideo, UNFINISHED } from "@/server/videos";
import { failureMessage, type PipelineDeps, processVideo } from "./pipeline";

// BullMQ side of the worker: runs the pipeline for each job, gives up after the last attempt
// (the video is marked failed and its credit refunded) and recovers videos left behind.

export type VideoWorkerOptions = {
  connection: Redis;
  deps: PipelineDeps;
  concurrency: number;
  prefix?: string;
  /** How long a job is locked without a heartbeat before another worker may take it over. */
  lockDurationMs?: number;
  stalledIntervalMs?: number;
  log?: (msg: string) => void;
};

export function createVideoWorker(o: VideoWorkerOptions): Worker<VideoJobData> {
  const log = o.log ?? ((m: string) => console.log(`[worker] ${m}`));
  const worker = new Worker<VideoJobData>(
    VIDEO_QUEUE,
    async (job) => {
      log(`video ${job.data.videoId}: attempt ${job.attemptsMade + 1}`);
      return processVideo(o.deps, job.data.videoId);
    },
    {
      connection: o.connection,
      prefix: o.prefix,
      concurrency: o.concurrency,
      lockDuration: o.lockDurationMs ?? 60_000,
      stalledInterval: o.stalledIntervalMs ?? 30_000,
      // A job whose worker died is taken over (stalled); after 2 such losses it fails for good.
      maxStalledCount: 2,
    },
  );

  worker.on("completed", (job, result) => log(`video ${job.data.videoId}: ${result}`));
  worker.on("failed", (job, err) => {
    if (!job) return;
    void (async () => {
      // The "failed" event fires for every failed attempt; only the last one fails the video.
      const state = await job.getState().catch(() => "failed");
      if (state !== "failed") {
        log(`video ${job.data.videoId}: attempt ${job.attemptsMade} failed, retrying (${err.message})`);
        return;
      }
      const message = failureMessage(job.failedReason || err.message, job.attemptsMade);
      const failed = await failVideo(o.deps.db, job.data.videoId, message);
      log(`video ${job.data.videoId}: failed for good${failed ? ", credit refunded" : ""} (${message})`);
    })().catch((e) => console.error("[worker] could not record a failure:", e));
  });
  worker.on("error", (e) => console.error("[worker]", e.message));
  return worker;
}

/**
 * Safety net, run at start and every minute: an unfinished video with no job (Redis was down when
 * it was created, or the job was lost) goes back to the queue; one whose job already failed for
 * good but was never marked (the worker died at that moment) is failed and refunded now.
 */
export async function recoverVideos(db: Db, queue: Queue<VideoJobData>, opts: { olderThanMs?: number; backoffMs?: number } = {}) {
  const cutoff = new Date(Date.now() - (opts.olderThanMs ?? 60_000));
  const stale = await db
    .select({ id: videos.id })
    .from(videos)
    .where(and(inArray(videos.status, UNFINISHED), lt(videos.updatedAt, cutoff)))
    .orderBy(sql`${videos.createdAt}`)
    .limit(500);
  let requeued = 0;
  let failed = 0;
  for (const { id } of stale) {
    const job = await queue.getJob(id);
    if (!job) {
      await enqueueVideo(queue, id, videoJobOptions(opts.backoffMs));
      requeued++;
    } else if ((await job.getState()) === "failed") {
      if (await failVideo(db, id, failureMessage(job.failedReason, job.attemptsMade))) failed++;
    }
  }
  return { requeued, failed };
}
