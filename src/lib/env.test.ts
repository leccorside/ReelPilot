import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://user:pass@postgres:5432/db",
  REDIS_URL: "redis://redis:6379",
  S3_ENDPOINT: "http://s3:8333",
  S3_ACCESS_KEY: "key",
  S3_SECRET_KEY: "secret-123",
  S3_BUCKET: "reelpilot-media",
  SMTP_HOST: "mailpit",
  SMTP_PORT: "1025",
  MAIL_FROM: "ReelPilot <no-reply@localhost>",
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
};

describe("parseEnv", () => {
  it("accepts a complete environment and applies defaults", () => {
    const env = parseEnv(valid);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.S3_REGION).toBe("us-east-1");
    expect(env.NODE_ENV).toBe("development");
  });

  it("lists every invalid variable in one error", () => {
    const broken = { ...valid, DATABASE_URL: "mysql://x@y/z", S3_SECRET_KEY: "123", S3_BUCKET: "Bad_Bucket", ENCRYPTION_KEY: "curta" };
    delete (broken as Record<string, string | undefined>).REDIS_URL;
    expect(() => parseEnv(broken)).toThrowError(
      /DATABASE_URL[\s\S]*REDIS_URL[\s\S]*S3_SECRET_KEY[\s\S]*S3_BUCKET[\s\S]*ENCRYPTION_KEY/,
    );
  });
});
