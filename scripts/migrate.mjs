// Applies the pending SQL migrations in ./drizzle and exits.
// Plain JavaScript on purpose: it runs in the "migrate" container (dev image and the
// small production runner-migrate image) without TypeScript tooling.
//
//   node scripts/migrate.mjs                 -> uses DATABASE_URL
//   node scripts/migrate.mjs <database-url>  -> another database (tests)

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";

const url = process.argv[2] ?? process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL não definida");
  process.exit(1);
}

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const client = postgres(url, { max: 1, onnotice: () => {} });
const started = Date.now();

try {
  await migrate(drizzle(client), { migrationsFolder });
  const [{ count }] = await client`select count(*)::int as count from drizzle.__drizzle_migrations`;
  console.log(`[migrate] banco atualizado: ${count} migração(ões) aplicada(s) no total, em ${Date.now() - started} ms`);
} catch (error) {
  console.error("[migrate] falhou:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
