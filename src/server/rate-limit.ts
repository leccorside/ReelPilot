import type Redis from "ioredis";

// Fixed-window counters in Redis. Each key counts events in a window that starts at the first
// event; the window expires on its own. Good enough to stop password guessing and sign-up spam.

export type Limit = { max: number; windowSec: number };
export type LimitState = { blocked: boolean; count: number; retryAfterSec: number };

/** Reads the counter without changing it. */
export async function peek(r: Redis, key: string, limit: Limit): Promise<LimitState> {
  const [count, ttl] = await r.multi().get(key).ttl(key).exec().then((res) => [Number(res?.[0]?.[1] ?? 0), Number(res?.[1]?.[1] ?? -2)]);
  return { blocked: count >= limit.max, count, retryAfterSec: count >= limit.max ? Math.max(ttl, 1) : 0 };
}

/** Counts one event and tells whether the limit is now exceeded. */
export async function hit(r: Redis, key: string, limit: Limit): Promise<LimitState> {
  const res = await r.multi().incr(key).expire(key, limit.windowSec, "NX").ttl(key).exec();
  const count = Number(res?.[0]?.[1] ?? 0);
  const ttl = Number(res?.[2]?.[1] ?? limit.windowSec);
  return { blocked: count > limit.max, count, retryAfterSec: count > limit.max ? Math.max(ttl, 1) : 0 };
}

export async function reset(r: Redis, key: string): Promise<void> {
  await r.del(key);
}

/** Applies AUTH_RATE_LIMIT_SCALE (development uses a higher scale so E2E runs can repeat). */
export function scaled(limit: Limit, scale: number): Limit {
  return { max: Math.max(1, Math.round(limit.max * scale)), windowSec: limit.windowSec };
}
