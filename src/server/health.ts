import postgres from "postgres";
import Redis from "ioredis";
import type { Env } from "@/lib/env";

// Readiness checks for the services the app depends on. Each check opens a short-lived
// connection with a tight timeout, so a broken dependency never hangs the health route.

export type CheckResult = { ok: boolean; ms: number; error?: string };
export type HealthReport = { ok: boolean; checks: Record<"database" | "redis" | "storage", CheckResult> };

const TIMEOUT_MS = 3000;

async function timed(fn: () => Promise<void>): Promise<CheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - start };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function checkDatabase(url: string): Promise<CheckResult> {
  return timed(async () => {
    const sql = postgres(url, { max: 1, connect_timeout: TIMEOUT_MS / 1000, idle_timeout: 1 });
    try {
      const [row] = await sql`select 1 as ok`;
      if (row?.ok !== 1) throw new Error("resposta inesperada do banco");
    } finally {
      await sql.end({ timeout: 1 });
    }
  });
}

export async function checkRedis(url: string): Promise<CheckResult> {
  return timed(async () => {
    const redis = new Redis(url, {
      lazyConnect: true,
      connectTimeout: TIMEOUT_MS,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    // The failure is reported by connect()/ping() below; without a listener ioredis also logs it as unhandled.
    redis.on("error", () => {});
    try {
      await redis.connect();
      const pong = await redis.ping();
      if (pong !== "PONG") throw new Error(`resposta inesperada: ${pong}`);
    } finally {
      redis.disconnect();
    }
  });
}

/** The S3 endpoint is up when it answers HTTP (any status below 500). Bucket access is tested in Passo 4. */
export async function checkStorage(endpoint: string): Promise<CheckResult> {
  return timed(async () => {
    const res = await fetch(endpoint, { method: "GET", signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  });
}

export async function healthReport(e: Pick<Env, "DATABASE_URL" | "REDIS_URL" | "S3_ENDPOINT">): Promise<HealthReport> {
  const [database, redis, storage] = await Promise.all([
    checkDatabase(e.DATABASE_URL),
    checkRedis(e.REDIS_URL),
    checkStorage(e.S3_ENDPOINT),
  ]);
  return { ok: database.ok && redis.ok && storage.ok, checks: { database, redis, storage } };
}
