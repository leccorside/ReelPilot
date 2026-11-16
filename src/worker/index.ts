import { mkdir, rm, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { env } from "@/lib/env";
import { createDb } from "@/server/db";
import { createStorage } from "@/server/storage";
import { createVideoQueue, queueConnection } from "@/server/video-queue";
import { cpuQuota, ffmpegThreads } from "./ffmpeg";
import { createProviders, describeProviders } from "./providers";
import { createVideoWorker, recoverVideos } from "./worker";

// Entry point of the "worker" container: consumes the "video-generation" queue.
//   development: tsx watch src/worker/index.ts (restarts on code changes)
//   production:  node worker.mjs (bundled by `npm run build:worker`)

const HEARTBEAT_FILE = "/tmp/worker-alive";

async function main() {
  const e = env();
  const { db, client } = createDb(e.DATABASE_URL, { max: e.WORKER_CONCURRENCY + 2 });
  const storage = createStorage({ endpoint: e.S3_ENDPOINT, region: e.S3_REGION, accessKey: e.S3_ACCESS_KEY, secretKey: e.S3_SECRET_KEY, bucket: e.S3_BUCKET });
  const providers = createProviders(e);

  // Own subfolder per container (the volume may be shared by scaled workers). Whatever is in it
  // is from a previous run of this container that was stopped mid-video: start clean.
  const tmpRoot = join(e.WORKER_TMP_DIR, hostname());
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(tmpRoot, { recursive: true });

  const workerConnection = queueConnection();
  const queueConn = queueConnection();
  const queue = createVideoQueue(queueConn);
  const threads = ffmpegThreads(e.WORKER_CONCURRENCY);
  const worker = createVideoWorker({ connection: workerConnection, deps: { db, storage, providers, tmpRoot, ffmpegThreads: threads }, concurrency: e.WORKER_CONCURRENCY });
  console.log(`[worker] started: ${e.WORKER_CONCURRENCY} at a time, ${cpuQuota()} CPU, ${threads} ffmpeg thread(s) each, ${describeProviders(e)}, scratch=${tmpRoot}`);

  const heartbeat = setInterval(() => {
    if (worker.isRunning() && workerConnection.status === "ready") void writeFile(HEARTBEAT_FILE, String(Date.now())).catch(() => {});
  }, 5_000);

  const sweep = async () => {
    try {
      const r = await recoverVideos(db, queue);
      if (r.requeued || r.failed) console.log(`[worker] recovery: ${r.requeued} re-queued, ${r.failed} failed`);
    } catch (err) {
      console.error("[worker] recovery sweep failed:", err instanceof Error ? err.message : err);
    }
  };
  void sweep();
  const sweeper = setInterval(sweep, 60_000);

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[worker] ${signal}: finishing the videos in progress (up to 25 s)...`);
    clearInterval(heartbeat);
    clearInterval(sweeper);
    // Waits for the running jobs; what doesn't finish in time is taken over after a restart.
    await Promise.race([worker.close(), new Promise((r) => setTimeout(r, 25_000))]);
    await queue.close().catch(() => {});
    workerConnection.disconnect();
    queueConn.disconnect();
    await client.end({ timeout: 5 }).catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] could not start:", err);
  process.exit(1);
});
