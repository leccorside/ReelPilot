import { env } from "@/lib/env";
import { db } from "@/server/db";
import type { MusicDeps } from "@/server/music";
import { redis } from "@/server/redis";
import { storage } from "@/server/storage";

/** The real dependencies of the music module (tests build their own). */
export function musicDeps(): MusicDeps {
  const e = env();
  return { db: db(), storage: storage(), redis: redis(), secret: e.AUTH_SECRET, rateLimitScale: e.AUTH_RATE_LIMIT_SCALE };
}
