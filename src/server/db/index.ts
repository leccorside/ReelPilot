import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
/** An open transaction (same query API as Db, without starting a new transaction). */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

/** Creates a Drizzle client for a connection string (used by tests, scripts and the app). */
export function createDb(url: string, options: { max?: number } = {}) {
  const client = postgres(url, { max: options.max ?? 10, onnotice: () => {} });
  return { db: drizzle(client, { schema }) as Db, client };
}

// One pool per server process. In development the module is reloaded on every change,
// so the pool is kept on globalThis to avoid opening a new one each time.
const globalForDb = globalThis as unknown as { __reelpilotDb?: ReturnType<typeof createDb> };

export function db(): Db {
  if (!globalForDb.__reelpilotDb) globalForDb.__reelpilotDb = createDb(env().DATABASE_URL);
  return globalForDb.__reelpilotDb.db;
}

export { schema };
