import { defineConfig } from "drizzle-kit";

// Generate a migration after changing the schema (runs inside the container):
//   .\scripts\dc.ps1 db-generate <nome-da-migracao>
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
