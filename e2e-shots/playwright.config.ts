import { defineConfig } from "@playwright/test";

// Temporary (break-ui): screenshots of the series editor with each dataset. Not part of the test suite.
export default defineConfig({
  testDir: ".",
  timeout: 180_000,
  workers: 1,
  reporter: [["line"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" },
});
