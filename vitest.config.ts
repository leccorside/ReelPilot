import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Runs inside the "web" container (docker compose run --rm web npm test),
// so integration tests reach postgres, redis and s3 by their service names.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 15000,
  },
});
