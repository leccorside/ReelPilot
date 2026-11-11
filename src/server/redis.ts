import Redis from "ioredis";
import { env } from "@/lib/env";

// One connection per server process (kept on globalThis across dev reloads).
const globalForRedis = globalThis as unknown as { __reelpilotRedis?: Redis };

export function redis(): Redis {
  if (!globalForRedis.__reelpilotRedis) {
    const client = new Redis(env().REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: true });
    client.on("error", (e) => console.error("[redis]", e.message));
    globalForRedis.__reelpilotRedis = client;
  }
  return globalForRedis.__reelpilotRedis;
}
