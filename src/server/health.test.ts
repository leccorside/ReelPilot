import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";
import { checkDatabase, checkRedis, checkStorage, healthReport } from "./health";

// Integration tests: they talk to the real postgres, redis and s3 containers of docker-compose.yml.
describe("health checks (integration)", () => {
  it("reaches every service of the compose environment", async () => {
    const report = await healthReport(env());
    expect(report.checks.database).toMatchObject({ ok: true });
    expect(report.checks.redis).toMatchObject({ ok: true });
    expect(report.checks.storage).toMatchObject({ ok: true });
    expect(report.ok).toBe(true);
  });

  it("reports failures instead of throwing or hanging", async () => {
    const [db, redis, storage] = await Promise.all([
      checkDatabase("postgres://nobody:wrong@postgres:5432/missing"),
      checkRedis("redis://redis:1"),
      checkStorage("http://no-such-host.invalid:8333"),
    ]);
    for (const r of [db, redis, storage]) {
      expect(r.ok).toBe(false);
      expect(r.error).toBeTruthy();
      expect(r.ms).toBeLessThan(10000);
    }
  });
});
