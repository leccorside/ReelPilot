import { spawnSync } from "node:child_process";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

// Before the test run: drop and recreate "<database>_test", then apply every migration with the
// same script the "migrate" container uses. This proves the migrations build the schema from zero
// and keeps the development data untouched.

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) throw new Error("DATABASE_URL não definida (rode os testes dentro do container: .\\scripts\\dc.ps1 test)");

  const url = new URL(devUrl);
  const testDb = `${url.pathname.slice(1)}_test`;
  if (!/^[a-z0-9_]+$/.test(testDb)) throw new Error(`nome de banco de teste inválido: ${testDb}`);

  const admin = postgres(devUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists "${testDb}" with (force)`);
    await admin.unsafe(`create database "${testDb}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }

  url.pathname = `/${testDb}`;
  const testUrl = url.toString();

  const result = spawnSync(process.execPath, ["scripts/migrate.mjs", testUrl], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`migrações falharam no banco de teste:\n${result.stdout}\n${result.stderr}`);

  project.provide("testDatabaseUrl", testUrl);
}
