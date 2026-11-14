import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDb } from "@/server/db";
import { createStorage } from "@/server/storage";
import { queueConnection } from "@/server/video-queue";
import { fakeProviders } from "../providers/fake";
import { createVideoWorker } from "../worker";

// TESTS ONLY (src/worker/queue.test.ts): a worker in its own process, so a test can kill it with
// SIGKILL in the middle of a video, exactly like a crashed or killed container. Configured by:
//   CHILD_DB_URL, CHILD_REDIS_URL, CHILD_PREFIX, CHILD_LOCK_MS, CHILD_STALLED_MS, CHILD_IMAGE_DELAY_MS

const e = process.env;
const { db } = createDb(e.CHILD_DB_URL!, { max: 3 });
const storage = createStorage({ endpoint: e.S3_ENDPOINT!, region: e.S3_REGION ?? "us-east-1", accessKey: e.S3_ACCESS_KEY!, secretKey: e.S3_SECRET_KEY!, bucket: e.S3_BUCKET! });
const providers = fakeProviders(0);
const imageDelay = Number(e.CHILD_IMAGE_DELAY_MS ?? 0);
const slowImages = { draw: async (input: Parameters<typeof providers.images.draw>[0]) => (await new Promise((r) => setTimeout(r, imageDelay)), providers.images.draw(input)) };

async function main() {
  const tmpRoot = join(tmpdir(), `reelpilot-child-${process.pid}`);
  await mkdir(tmpRoot, { recursive: true });
  const worker = createVideoWorker({
    connection: queueConnection(e.CHILD_REDIS_URL!),
    prefix: e.CHILD_PREFIX,
    deps: { db, storage, providers: { ...providers, images: slowImages }, tmpRoot },
    concurrency: 1,
    lockDurationMs: Number(e.CHILD_LOCK_MS ?? 2000),
    stalledIntervalMs: Number(e.CHILD_STALLED_MS ?? 1000),
    log: (m) => console.log(`[child ${process.pid}] ${m}`),
  });
  await worker.waitUntilReady();
  console.log("[child] ready");
}

void main();
