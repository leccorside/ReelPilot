import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createDb } from "@/server/db";
import { getCreditBalance, SIGNUP_BONUS_CREDITS } from "@/server/db/credits";
import { users } from "@/server/db/schema";
import { bumpSessionVersion, clientIp, getSessionVersion, grantSignupBonus, LIMITS, registerUser, verifyCredentials } from "./accounts";

// Integration tests: test database (<db>_test) and Redis logical database 1 (flushed here).
const { db, client } = createDb(inject("testDatabaseUrl"), { max: 4 });
const redisUrl = new URL(process.env.REDIS_URL ?? "redis://redis:6379");
redisUrl.pathname = "/1";
const r = new Redis(redisUrl.toString());

beforeAll(async () => {
  await r.flushdb();
});
afterAll(async () => {
  await client.end({ timeout: 5 });
  r.disconnect();
});

const ip = () => `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}-${randomUUID()}`;
const email = () => `user-${randomUUID()}@test.dev`;
const PASSWORD = "correct horse battery";

describe("registerUser", () => {
  it("creates the account with a hashed password and the signup bonus", async () => {
    const address = email();
    const result = await registerUser(db, r, { email: `  ${address.toUpperCase()} `, password: PASSWORD }, { ip: ip() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.email).toBe(address); // trimmed and lowercased
    expect(result.user.name).toBe(address.split("@")[0]);

    const [row] = await db.select().from(users).where(eq(users.id, result.user.id));
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.passwordHash).not.toContain(PASSWORD);
    expect(await getCreditBalance(db, result.user.id)).toBe(SIGNUP_BONUS_CREDITS);
  });

  it("rejects duplicates regardless of letter case, and invalid input", async () => {
    const address = email();
    expect((await registerUser(db, r, { email: address, password: PASSWORD }, { ip: ip() })).ok).toBe(true);
    expect(await registerUser(db, r, { email: address.toUpperCase(), password: PASSWORD }, { ip: ip() })).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(await registerUser(db, r, { email: "not-an-email", password: PASSWORD }, { ip: ip() })).toMatchObject({ ok: false, status: 400 });
    expect(await registerUser(db, r, { email: email(), password: "short" }, { ip: ip() })).toMatchObject({
      ok: false,
      status: 400,
      error: "Password must be at least 8 characters.",
    });
    expect(await registerUser(db, r, undefined, { ip: ip() })).toMatchObject({ ok: false, status: 400 });
  });

  it("limits sign-ups per IP", async () => {
    const sameIp = ip();
    for (let i = 0; i < LIMITS.signupsPerIp.max; i++) {
      expect((await registerUser(db, r, { email: email(), password: PASSWORD }, { ip: sameIp })).ok).toBe(true);
    }
    const blocked = await registerUser(db, r, { email: email(), password: PASSWORD }, { ip: sameIp });
    expect(blocked).toMatchObject({ ok: false, status: 429 });
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});

describe("verifyCredentials", () => {
  async function account() {
    const address = email();
    const result = await registerUser(db, r, { email: address, password: PASSWORD }, { ip: ip() });
    if (!result.ok) throw new Error("setup failed");
    return { address, id: result.user.id };
  }

  it("accepts the right password (any letter case in the e-mail) and rejects wrong ones", async () => {
    const { address, id } = await account();
    const ok = await verifyCredentials(db, r, { email: address.toUpperCase(), password: PASSWORD }, { ip: ip() });
    expect(ok).toMatchObject({ ok: true, user: { id, email: address, sessionVersion: 0 } });

    expect(await verifyCredentials(db, r, { email: address, password: "wrong password" }, { ip: ip() })).toEqual({ ok: false, reason: "invalid" });
    expect(await verifyCredentials(db, r, { email: email(), password: PASSWORD }, { ip: ip() })).toEqual({ ok: false, reason: "invalid" });
    expect(await verifyCredentials(db, r, { email: "", password: "" }, { ip: ip() })).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks an e-mail after repeated wrong passwords, even with the right one", async () => {
    const { address } = await account();
    const max = LIMITS.loginFailuresPerEmail.max;
    for (let i = 0; i < max; i++) {
      expect(await verifyCredentials(db, r, { email: address, password: "nope" }, { ip: ip() })).toMatchObject({ reason: "invalid" });
    }
    // After `max` wrong passwords the e-mail is locked for the window, from any IP.
    const locked = await verifyCredentials(db, r, { email: address, password: PASSWORD }, { ip: ip() });
    expect(locked).toMatchObject({ ok: false, reason: "rate_limited" });
    if (!locked.ok) expect(locked.retryAfterSec).toBeGreaterThan(0);
  });

  it("clears the failure count after a successful sign-in", async () => {
    const { address } = await account();
    const max = LIMITS.loginFailuresPerEmail.max;
    for (let i = 0; i < max - 1; i++) await verifyCredentials(db, r, { email: address, password: "nope" }, { ip: ip() });
    expect((await verifyCredentials(db, r, { email: address, password: PASSWORD }, { ip: ip() })).ok).toBe(true);
    // Counter reset: another wrong password is just "invalid" again.
    expect(await verifyCredentials(db, r, { email: address, password: "nope" }, { ip: ip() })).toMatchObject({ reason: "invalid" });
  });

  it("limits attempts per IP, and the scale setting raises the limits", async () => {
    const sameIp = ip();
    const max = LIMITS.loginAttemptsPerIp.max;
    for (let i = 0; i < max; i++) await verifyCredentials(db, r, { email: email(), password: "x" }, { ip: sameIp });
    expect(await verifyCredentials(db, r, { email: email(), password: "x" }, { ip: sameIp })).toMatchObject({ reason: "rate_limited" });

    const scaledIp = ip();
    for (let i = 0; i < max + 1; i++) {
      expect(await verifyCredentials(db, r, { email: email(), password: "x" }, { ip: scaledIp, rateLimitScale: 2 })).toMatchObject({
        reason: "invalid",
      });
    }
  });
});

describe("session version and signup bonus", () => {
  it("bumps the version (sign out everywhere) and returns null for deleted users", async () => {
    const result = await registerUser(db, r, { email: email(), password: PASSWORD }, { ip: ip() });
    if (!result.ok) throw new Error("setup failed");
    expect(await getSessionVersion(db, result.user.id)).toBe(0);
    await bumpSessionVersion(db, result.user.id);
    expect(await getSessionVersion(db, result.user.id)).toBe(1);
    await db.delete(users).where(eq(users.id, result.user.id));
    expect(await getSessionVersion(db, result.user.id)).toBeNull();
  });

  it("grants the signup bonus only once (Google accounts)", async () => {
    const [user] = await db.insert(users).values({ email: email() }).returning();
    await grantSignupBonus(db, user.id);
    await grantSignupBonus(db, user.id);
    expect(await getCreditBalance(db, user.id)).toBe(SIGNUP_BONUS_CREDITS);
  });
});

describe("clientIp", () => {
  it("uses the last X-Forwarded-For entry (added by our proxy), then X-Real-IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
