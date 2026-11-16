import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { Worker } from "bullmq";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { env } from "@/lib/env";
import { createDb } from "@/server/db";
import { videos } from "@/server/db/schema";
import { createVideoQueue, enqueueVideo, queueConnection, VIDEO_QUEUE, videoJobOptions } from "@/server/video-queue";
import { fakeProviders } from "./providers/fake";
import { ProviderError } from "./providers/types";
import { credits, newVideo, stepRows, testStorage, testTmpRoot, videoRow, waitFor } from "./test-helpers";
import { createVideoWorker, recoverVideos } from "./worker";

// The queue for real: BullMQ on Redis (logical db 3, own key prefix per run), test database, S3.
const { db, client } = createDb(inject("testDatabaseUrl"), { max: 8 });
const redisUrl = new URL(env().REDIS_URL);
redisUrl.pathname = "/3";
const prefix = `test-${randomUUID().slice(0, 8)}`;
const conn = queueConnection(redisUrl.toString());
const queue = createVideoQueue(conn, prefix);
const storage = testStorage();
const fastRetries = videoJobOptions(50);
let tmpRoot = "";
const children: ChildProcess[] = [];

beforeAll(async () => {
  tmpRoot = await testTmpRoot();
});
afterAll(async () => {
  for (const c of children) c.kill("SIGKILL");
  await queue.obliterate({ force: true }).catch(() => {});
  await queue.close();
  conn.disconnect();
  await rm(tmpRoot, { recursive: true, force: true });
  await client.end({ timeout: 5 });
});

/** A worker in a separate process (src/worker/testing/child-worker.ts) that the test can SIGKILL. */
function childWorker(imageDelayMs: number) {
  const child = spawn(process.execPath, ["--import", "tsx", "src/worker/testing/child-worker.ts"], {
    env: {
      ...process.env,
      CHILD_DB_URL: inject("testDatabaseUrl"),
      CHILD_REDIS_URL: redisUrl.toString(),
      CHILD_PREFIX: prefix,
      CHILD_LOCK_MS: "2000",
      CHILD_STALLED_MS: "1000",
      CHILD_IMAGE_DELAY_MS: String(imageDelayMs),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  let output = "";
  child.stdout!.on("data", (d) => (output += d));
  child.stderr!.on("data", (d) => (output += d));
  const ready = waitFor("child worker to start", async () => output.includes("[child] ready") || (child.exitCode !== null && Promise.reject(new Error(output))), 30_000);
  return { child, ready, output: () => output };
}

describe("video queue", { timeout: 90_000 }, () => {
  it("after the last failed attempt the video fails with a readable message and its credit comes back", async () => {
    const { userId, videoId } = await newVideo(db);
    const base = fakeProviders();
    const worker = createVideoWorker({
      connection: queueConnection(redisUrl.toString()),
      prefix,
      concurrency: 1,
      deps: { db, storage, tmpRoot, providers: { ...base, tts: { speak: async () => Promise.reject(new Error("Kokoro is not answering")) } } },
      log: () => {},
    });
    try {
      await enqueueVideo(queue, videoId, fastRetries);
      const v = await waitFor("the video to fail", async () => {
        const row = await videoRow(db, videoId);
        return row.status === "failed" && row;
      });
      expect(v.error).toBe("Recording the voice failed: Kokoro is not answering (tried 3 times)");
      expect((await stepRows(db, videoId)).voice).toMatchObject({ status: "failed", attempts: 3 });
      expect(await credits(db, userId, videoId)).toEqual({ debits: 1, refunds: 1, balance: 5 });
    } finally {
      await worker.close();
    }
  });

  it("a failure that retrying can't fix (declined topic) fails the video at the first attempt, refunded", async () => {
    const { userId, videoId } = await newVideo(db);
    const declined = "The AI declined to write a script for this series. Change the series' niche and try again.";
    const worker = createVideoWorker({
      connection: queueConnection(redisUrl.toString()),
      prefix,
      concurrency: 1,
      deps: { db, storage, tmpRoot, providers: { ...fakeProviders(), script: { write: async () => Promise.reject(new ProviderError(declined, false)) } } },
      log: () => {},
    });
    try {
      await enqueueVideo(queue, videoId, fastRetries);
      const v = await waitFor("the video to fail", async () => {
        const row = await videoRow(db, videoId);
        return row.status === "failed" && row;
      });
      expect(v.error).toBe(declined); // no "(tried 3 times)": one attempt only
      expect((await stepRows(db, videoId)).script).toMatchObject({ status: "failed", attempts: 1 });
      expect(await credits(db, userId, videoId)).toEqual({ debits: 1, refunds: 1, balance: 5 });
    } finally {
      await worker.close();
    }
  });

  it("a worker killed in the middle of a video: the next one resumes it, without redoing steps or charging again", async () => {
    const { userId, videoId } = await newVideo(db);
    const first = childWorker(30_000); // stuck in the images step until killed
    await first.ready;
    await enqueueVideo(queue, videoId, fastRetries);
    await waitFor("the images step to start", async () => (await videoRow(db, videoId)).status === "imaging", 30_000);
    first.child.kill("SIGKILL");

    const second = childWorker(0);
    await second.ready;
    const v = await waitFor("the video to be ready", async () => {
      const row = await videoRow(db, videoId);
      return row.status === "ready" && row;
    }, 60_000);

    expect(v.videoKey).toBeTruthy();
    const steps = await stepRows(db, videoId);
    expect(steps.script).toMatchObject({ status: "succeeded", attempts: 1 });
    expect(steps.voice).toMatchObject({ status: "succeeded", attempts: 1 });
    expect(steps.images).toMatchObject({ status: "succeeded", attempts: 2 }); // started again after the kill
    expect(await credits(db, userId, videoId)).toEqual({ debits: 1, refunds: 0, balance: 4 });
    second.child.kill("SIGTERM");
  }, 90_000);

  it("recovery: a video left out of the queue goes back in; one whose job failed unnoticed is failed and refunded", async () => {
    const lost = await newVideo(db);
    const unnoticed = await newVideo(db);
    await db.update(videos).set({ updatedAt: sql`now() - interval '5 minutes'` }).where(eq(videos.id, lost.videoId));

    // A job that fails for good with nobody recording it (a plain BullMQ worker, not ours).
    await enqueueVideo(queue, unnoticed.videoId, { ...fastRetries, attempts: 1 });
    const raw = new Worker(VIDEO_QUEUE, async () => Promise.reject(new Error("Rendering failed: disk full")), { connection: queueConnection(redisUrl.toString()), prefix });
    await waitFor("the raw job to fail", async () => (await (await queue.getJob(unnoticed.videoId))?.getState()) === "failed");
    await raw.close();
    await db.update(videos).set({ updatedAt: sql`now() - interval '5 minutes'` }).where(eq(videos.id, unnoticed.videoId));

    const result = await recoverVideos(db, queue);
    expect(result.requeued).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBeGreaterThanOrEqual(1);
    expect(await queue.getJob(lost.videoId)).toBeTruthy();
    expect(await videoRow(db, unnoticed.videoId)).toMatchObject({ status: "failed", error: "Rendering failed: disk full" });
    expect(await credits(db, unnoticed.userId, unnoticed.videoId)).toMatchObject({ refunds: 1 });

    // Running it again changes nothing (the job id is the video id).
    await recoverVideos(db, queue);
    expect(await queue.getJobCountByTypes("waiting", "delayed")).toBeGreaterThanOrEqual(1);
    await (await queue.getJob(lost.videoId))?.remove();
  });
});
