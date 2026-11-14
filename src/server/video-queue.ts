import { Queue, type JobsOptions } from "bullmq";
import Redis from "ioredis";
import { env } from "@/lib/env";

// The "video-generation" queue (BullMQ on Redis), shared by the web app (adds jobs) and the worker
// (src/worker). One job per video, with the video id as the job id: adding the same video twice
// is a no-op, so re-queuing (the recovery sweep, a retried request) can never make it twice.

export const VIDEO_QUEUE = "video-generation";

export type VideoJobData = { videoId: string };

/** Attempts per video, with exponential waits between them (10 s, then 20 s by default). */
export const VIDEO_JOB_ATTEMPTS = 3;

export function videoJobOptions(backoffMs = 10_000): JobsOptions {
  return {
    attempts: VIDEO_JOB_ATTEMPTS,
    backoff: { type: "exponential", delay: backoffMs },
    // Finished jobs are not needed (the video row has the result); failed ones are kept a week
    // for inspection, and so the recovery sweep can tell "failed" from "never queued".
    removeOnComplete: true,
    removeOnFail: { age: 7 * 24 * 3600 },
  };
}

/** A Redis connection as BullMQ wants it (no per-command retry limit: blocking commands wait). */
export function queueConnection(url = env().REDIS_URL): Redis {
  const client = new Redis(url, { maxRetriesPerRequest: null });
  client.on("error", (e) => console.error("[video-queue]", e.message));
  return client;
}

export function createVideoQueue(connection: Redis, prefix?: string): Queue<VideoJobData> {
  return new Queue<VideoJobData>(VIDEO_QUEUE, { connection, prefix });
}

/** Adds a video to the queue (ignored when it is already there). */
export async function enqueueVideo(queue: Queue<VideoJobData>, videoId: string, opts: JobsOptions = videoJobOptions()): Promise<void> {
  await queue.add("generate", { videoId }, { ...opts, jobId: videoId });
}

/**
 * enqueueVideo with a deadline, for web requests: with Redis down, BullMQ waits for it to come
 * back, and a request must not hang. Throws on timeout; the recovery sweep queues the video later.
 */
export async function enqueueVideoWithin(queue: Queue<VideoJobData>, videoId: string, timeoutMs = 3000): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`queue did not answer within ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    await Promise.race([enqueueVideo(queue, videoId), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/** Takes a video out of the queue if it hasn't started (best effort: a running job just finds it gone). */
export async function removeQueuedVideo(queue: Queue<VideoJobData>, videoId: string): Promise<void> {
  const job = await queue.getJob(videoId);
  if (job && ["waiting", "delayed", "prioritized"].includes(await job.getState())) await job.remove().catch(() => {});
}

// The web app's queue (one per server process, kept across development reloads).
const globalForQueue = globalThis as unknown as { __reelpilotVideoQueue?: Queue<VideoJobData> };

export function videoQueue(): Queue<VideoJobData> {
  if (!globalForQueue.__reelpilotVideoQueue) globalForQueue.__reelpilotVideoQueue = createVideoQueue(queueConnection());
  return globalForQueue.__reelpilotVideoQueue;
}
