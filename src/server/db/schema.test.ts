import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, inject, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { createDb } from "./index";
import { getCreditBalance } from "./credits";
import * as s from "./schema";

// Integration tests against the "<db>_test" database built from zero by src/test/global-setup.ts.

const { db, client } = createDb(inject("testDatabaseUrl"), { max: 4 });
afterAll(() => client.end({ timeout: 5 }));

const KEY = Buffer.alloc(32, 9).toString("base64");

/** Postgres error code of a failed query (drizzle wraps the driver error in `cause`). */
async function pgErrorCode(query: Promise<unknown>): Promise<string> {
  try {
    await query;
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    return err.cause?.code ?? err.code ?? "sem-código";
  }
  throw new Error("a consulta deveria ter falhado");
}
const UNIQUE = "23505";
const CHECK = "23514";
const BAD_ENUM = "22P02";

async function newUser(email = `u-${randomUUID()}@test.dev`) {
  const [user] = await db.insert(s.users).values({ email, name: "Teste" }).returning();
  return user;
}

async function newSeries(userId: string, overrides: Partial<typeof s.series.$inferInsert> = {}) {
  const [row] = await db
    .insert(s.series)
    .values({
      userId,
      name: "Série",
      formats: ["storytelling"],
      niche: "Mistérios",
      language: "pt",
      voice: "adam",
      artStyle: "realism",
      captionStyle: "bold",
      frequency: "daily",
      postTime: "18:00",
      ...overrides,
    })
    .returning();
  return row;
}

async function newVideo(userId: string, seriesId: string) {
  const [row] = await db.insert(s.videos).values({ userId, seriesId, title: "Vídeo" }).returning();
  return row;
}

describe("migrations", () => {
  it("build the whole schema from an empty database", async () => {
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] };
    const [{ applied }] = await client`select count(*)::int as applied from drizzle.__drizzle_migrations`;
    expect(applied).toBe(journal.entries.length);

    const tables = await client`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
    expect(tables.map((t) => t.table_name)).toEqual([
      "accounts",
      "credit_ledger",
      "music_tracks",
      "series",
      "series_music_tracks",
      "sessions",
      "social_connections",
      "subscriptions",
      "users",
      "verification_tokens",
      "video_steps",
      "videos",
    ]);
  });
});

describe("users and Auth.js tables", () => {
  it("store users with defaults and enforce unique lowercase e-mails", async () => {
    const user = await newUser();
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user).toMatchObject({ timezone: "UTC", emailNotifications: true, autoPublish: true, passwordHash: null });

    expect(await pgErrorCode(db.insert(s.users).values({ email: user.email }))).toBe(UNIQUE);
    expect(await pgErrorCode(db.insert(s.users).values({ email: "Maiuscula@Test.dev" }))).toBe(CHECK);
  });

  it("store accounts, sessions and verification tokens", async () => {
    const user = await newUser();
    await db.insert(s.accounts).values({ userId: user.id, type: "oauth", provider: "google", providerAccountId: randomUUID() });
    const expires = new Date(Date.now() + 86_400_000);
    await db.insert(s.sessions).values({ sessionToken: randomUUID(), userId: user.id, expires });
    await db.insert(s.verificationTokens).values({ identifier: user.email, token: randomUUID(), expires });

    const accounts = await db.select().from(s.accounts).where(eq(s.accounts.userId, user.id));
    const sessions = await db.select().from(s.sessions).where(eq(s.sessions.userId, user.id));
    const tokens = await db.select().from(s.verificationTokens).where(eq(s.verificationTokens.identifier, user.email));
    expect([accounts.length, sessions.length, tokens.length]).toEqual([1, 1, 1]);
    expect(sessions[0].expires.getTime()).toBe(expires.getTime());
  });
});

describe("series and music", () => {
  it("store a series with every wizard field and validate it", async () => {
    const user = await newUser();
    const row = await newSeries(user.id, { formats: ["top5", "facts"], platforms: ["youtube", "tiktok"] });
    const [read] = await db.select().from(s.series).where(eq(s.series.id, row.id));
    expect(read).toMatchObject({
      formats: ["top5", "facts"],
      platforms: ["youtube", "tiktok"],
      status: "active",
      timezone: "UTC",
      usedTopics: [],
    });

    expect(await pgErrorCode(newSeries(user.id, { postTime: "25:00" }))).toBe(CHECK);
    expect(await pgErrorCode(newSeries(user.id, { formats: [] }))).toBe(CHECK);
    expect(
      await pgErrorCode(db.execute(sql`update series set frequency = 'hourly' where id = ${row.id}`)),
    ).toBe(BAD_ENUM);
  });

  it("link music tracks to series and cap uploads at 10 MB", async () => {
    const user = await newUser();
    const series = await newSeries(user.id);
    const base = { userId: user.id, source: "upload" as const, name: "Trilha", storageKey: "k", mimeType: "audio/mpeg" };
    const [track] = await db.insert(s.musicTracks).values({ ...base, sizeBytes: 1024 }).returning();
    await db.insert(s.seriesMusicTracks).values({ seriesId: series.id, musicTrackId: track.id });

    const links = await db.select().from(s.seriesMusicTracks).where(eq(s.seriesMusicTracks.seriesId, series.id));
    expect(links).toHaveLength(1);
    expect(await pgErrorCode(db.insert(s.musicTracks).values({ ...base, sizeBytes: 10 * 1024 * 1024 + 1 }))).toBe(CHECK);
  });
});

describe("videos and pipeline steps", () => {
  it("store the script as JSON and one row per step", async () => {
    const user = await newUser();
    const series = await newSeries(user.id);
    const video = await newVideo(user.id, series.id);
    expect(video.status).toBe("queued");

    const script: s.VideoScript = {
      title: "T",
      hook: "Gancho",
      scenes: [{ narration: "Era uma vez", visual: "Floresta" }],
      caption: "Legenda",
      hashtags: ["misterio"],
    };
    await db.update(s.videos).set({ script, status: "scripting" }).where(eq(s.videos.id, video.id));
    const [read] = await db.select().from(s.videos).where(eq(s.videos.id, video.id));
    expect(read.script).toEqual(script);
    expect(read.updatedAt.getTime()).toBeGreaterThanOrEqual(video.updatedAt.getTime());

    await db.insert(s.videoSteps).values({ videoId: video.id, step: "script", status: "succeeded", costMicroUsd: 4200 });
    const [step] = await db.select().from(s.videoSteps).where(eq(s.videoSteps.videoId, video.id));
    expect(step).toMatchObject({ step: "script", attempts: 0, costMicroUsd: 4200 });

    expect(await pgErrorCode(db.insert(s.videoSteps).values({ videoId: video.id, step: "script" }))).toBe(UNIQUE);
    expect(await pgErrorCode(db.execute(sql`update videos set status = 'done' where id = ${video.id}`))).toBe(BAD_ENUM);
  });
});

describe("credit ledger", () => {
  it("computes the balance from the entries and blocks double charges", async () => {
    const user = await newUser();
    const series = await newSeries(user.id);
    const video = await newVideo(user.id, series.id);

    await db.insert(s.creditLedger).values([
      { userId: user.id, delta: 60, reason: "signup_bonus" },
      { userId: user.id, delta: -1, reason: "video_debit", videoId: video.id },
    ]);
    expect(await getCreditBalance(db, user.id)).toBe(59);

    // Same video charged twice, or refunded twice: rejected.
    expect(
      await pgErrorCode(db.insert(s.creditLedger).values({ userId: user.id, delta: -1, reason: "video_debit", videoId: video.id })),
    ).toBe(UNIQUE);
    await db.insert(s.creditLedger).values({ userId: user.id, delta: 1, reason: "video_refund", videoId: video.id });
    expect(
      await pgErrorCode(db.insert(s.creditLedger).values({ userId: user.id, delta: 1, reason: "video_refund", videoId: video.id })),
    ).toBe(UNIQUE);
    expect(await getCreditBalance(db, user.id)).toBe(60);

    // Deleting the video keeps the history (video_id becomes null) and the balance.
    await db.delete(s.videos).where(eq(s.videos.id, video.id));
    expect(await getCreditBalance(db, user.id)).toBe(60);
  });

  it("rejects zero, wrong signs and repeated idempotency keys", async () => {
    const user = await newUser();
    const add = (v: Partial<typeof s.creditLedger.$inferInsert>) =>
      db.insert(s.creditLedger).values({ userId: user.id, delta: 1, reason: "manual_adjustment", ...v });

    expect(await pgErrorCode(add({ delta: 0 }))).toBe(CHECK);
    expect(await pgErrorCode(add({ delta: 5, reason: "video_debit" }))).toBe(CHECK);
    expect(await pgErrorCode(add({ delta: -5, reason: "monthly_grant" }))).toBe(CHECK);
    await add({ delta: -3 }); // manual adjustments may go either way

    const key = `invoice-${randomUUID()}`;
    await add({ delta: 30, reason: "monthly_grant", idempotencyKey: key });
    expect(await pgErrorCode(add({ delta: 30, reason: "monthly_grant", idempotencyKey: key }))).toBe(UNIQUE);
    expect(await getCreditBalance(db, user.id)).toBe(27);
  });

  it("returns zero for a user without entries", async () => {
    const user = await newUser();
    expect(await getCreditBalance(db, user.id)).toBe(0);
  });
});

describe("subscriptions and social connections", () => {
  it("allow only one current subscription per user", async () => {
    const user = await newUser();
    await db.insert(s.subscriptions).values({ userId: user.id, plan: "starter", status: "canceled" });
    await db.insert(s.subscriptions).values({ userId: user.id, plan: "growth", status: "active", stripeSubscriptionId: randomUUID() });
    expect(
      await pgErrorCode(db.insert(s.subscriptions).values({ userId: user.id, plan: "pro", status: "trialing" })),
    ).toBe(UNIQUE);
  });

  it("store tokens only encrypted, one row per connected account", async () => {
    const user = await newUser();
    const values = {
      userId: user.id,
      platform: "youtube" as const,
      externalAccountId: "UC123",
      username: "@canal",
      accessTokenEnc: encryptSecret("ya29.real-token", KEY),
    };
    await db.insert(s.socialConnections).values(values);
    const [raw] = await client`select access_token_enc from social_connections where user_id = ${user.id}`;
    expect(raw.access_token_enc).not.toContain("ya29");
    expect(decryptSecret(raw.access_token_enc, KEY)).toBe("ya29.real-token");
    expect(await pgErrorCode(db.insert(s.socialConnections).values(values))).toBe(UNIQUE);
  });
});

describe("account deletion", () => {
  it("removes everything that belongs to the user", async () => {
    const user = await newUser();
    const series = await newSeries(user.id);
    const video = await newVideo(user.id, series.id);
    await db.insert(s.videoSteps).values({ videoId: video.id, step: "script" });
    await db.insert(s.creditLedger).values({ userId: user.id, delta: 60, reason: "signup_bonus" });
    await db.insert(s.socialConnections).values({
      userId: user.id,
      platform: "tiktok",
      externalAccountId: "tt1",
      username: "@tt",
      accessTokenEnc: encryptSecret("t", KEY),
    });

    await db.delete(s.users).where(eq(s.users.id, user.id));

    const [counts] = await client`
      select
        (select count(*) from series where user_id = ${user.id})::int as series,
        (select count(*) from videos where user_id = ${user.id})::int as videos,
        (select count(*) from video_steps where video_id = ${video.id})::int as steps,
        (select count(*) from credit_ledger where user_id = ${user.id})::int as ledger,
        (select count(*) from social_connections where user_id = ${user.id})::int as connections`;
    expect(counts).toEqual({ series: 0, videos: 0, steps: 0, ledger: 0, connections: 0 });
  });
});
