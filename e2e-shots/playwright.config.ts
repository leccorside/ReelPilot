import { defineConfig } from "@playwright/test";
// Temporary (break-ui): screenshots of the video grid. Not part of the test suite.
export default defineConfig({ testDir: ".", timeout: 240_000, workers: 2, reporter: [["line"]], use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" } });
