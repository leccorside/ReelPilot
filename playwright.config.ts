import { defineConfig, devices } from "@playwright/test";

// Runs in the "e2e" container (docker compose --profile test run --rm e2e) against http://web:3000.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/warmup.ts",
  timeout: 60_000,
  // The tests run against the development server, which compiles each page on its first visit.
  // Right after a code change, several workers can hit uncompiled pages at once: allow 30 s.
  expect: { timeout: 30_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
