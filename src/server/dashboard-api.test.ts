import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, inject, it } from "vitest";
import { createDb } from "@/server/db";
import { getCreditBalance } from "@/server/db/credits";
import { creditLedger, subscriptions, users, videos } from "@/server/db/schema";
import { InsufficientCreditsError, NotFoundError, PlanLimitError, ValidationError } from "@/server/errors";
import { deleteConnection, getMe, updateAccount } from "@/server/me";
import { createSeries, deleteSeries, getSeries, listSeries, updateSeries } from "@/server/series";
import { createVideo, deleteVideo, failVideo, getVideo, listVideos, videoCursor } from "@/server/videos";
import { socialConnections } from "@/server/db/schema";

// Integration tests of the dashboard API rules, against the "<db>_test" database.
const { db, client } = createDb(inject("testDatabaseUrl"), { max: 12 });
afterAll(() => client.end({ timeout: 5 }));

async function newUser(credits = 0, plan?: "starter" | "growth" | "pro") {
  const [user] = await db.insert(users).values({ email: `api-${randomUUID()}@test.dev` }).returning();
  if (credits) await db.insert(creditLedger).values({ userId: user.id, delta: credits, reason: "manual_adjustment" });
  if (plan) await db.insert(subscriptions).values({ userId: user.id, plan, status: "active" });
  return user.id;
}

const wizard = {
  name: "Unsolved Mysteries",
  formats: ["storytelling", "top5", "storytelling"],
  niche: "Unsolved mysteries and true crime",
  language: "en",
  voice: "adam",
  artStyle: "realism",
  captionStyle: "bold",
  platforms: ["youtube"],
  frequency: "daily",
  postTime: "18:00",
};

describe("series", () => {
  it("creates a series from the wizard fields, with defaults and the user's time zone", async () => {
    const userId = await newUser();
    const s = await createSeries(db, userId, wizard, "America/Sao_Paulo");
    expect(s).toMatchObject({
      name: "Unsolved Mysteries",
      formats: ["storytelling", "top5"], // duplicates dropped
      platforms: ["youtube"],
      status: "active",
      timezone: "America/Sao_Paulo",
      videoCount: 0,
      publishedCount: 0,
    });
    expect(await listSeries(db, userId)).toHaveLength(1);
  });

  it("rejects values that are not wizard options", async () => {
    const userId = await newUser();
    const bad: Record<string, unknown>[] = [
      { formats: [] },
      { formats: ["dance"] },
      { voice: "darth" },
      { frequency: "hourly" },
      { postTime: "25:00" },
      { timezone: "Mars/Olympus" },
      { platforms: ["myspace"] },
      { niche: "x" },
      { name: "" },
    ];
    for (const override of bad) {
      await expect(createSeries(db, userId, { ...wizard, ...override })).rejects.toBeInstanceOf(ValidationError);
    }
    await expect(createSeries(db, userId, undefined)).rejects.toBeInstanceOf(ValidationError);
  });

  it("pauses, resumes and edits; an empty update is refused", async () => {
    const userId = await newUser();
    const s = await createSeries(db, userId, wizard);
    expect((await updateSeries(db, userId, s.id, { status: "paused" })).status).toBe("paused");
    expect(await updateSeries(db, userId, s.id, { status: "active", postTime: "07:30", name: "Renamed" })).toMatchObject({
      status: "active",
      postTime: "07:30",
      name: "Renamed",
    });
    await expect(updateSeries(db, userId, s.id, {})).rejects.toBeInstanceOf(ValidationError);
  });

  it("is invisible to other users (404 for read, update and delete)", async () => {
    const owner = await newUser();
    const intruder = await newUser(5);
    const s = await createSeries(db, owner, wizard);

    await expect(getSeries(db, intruder, s.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateSeries(db, intruder, s.id, { status: "paused" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteSeries(db, intruder, s.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(createVideo(db, intruder, s.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await listSeries(db, intruder)).toEqual([]);
    expect(await getCreditBalance(db, intruder)).toBe(5); // nothing charged

    expect((await getSeries(db, owner, s.id)).status).toBe("active"); // untouched
  });

  it("answers 404 for malformed ids instead of a database error", async () => {
    const userId = await newUser();
    await expect(getSeries(db, userId, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getVideo(db, userId, "../etc")).rejects.toBeInstanceOf(NotFoundError);
    expect(await listVideos(db, userId, { seriesId: "nope" })).toEqual([]);
  });
});

describe("videos and credits", () => {
  it("charges 1 credit per video and numbers the videos", async () => {
    const userId = await newUser(3);
    const s = await createSeries(db, userId, wizard);
    const v1 = await createVideo(db, userId, s.id);
    const v2 = await createVideo(db, userId, s.id);
    expect([v1.title, v2.title]).toEqual(["Unsolved Mysteries #1", "Unsolved Mysteries #2"]);
    expect(v1).toMatchObject({ status: "queued", seriesName: "Unsolved Mysteries", hasFile: false });
    expect(await getCreditBalance(db, userId)).toBe(1);
    expect((await getSeries(db, userId, s.id)).videoCount).toBe(2);
  });

  it("refuses to create a video without credits", async () => {
    const userId = await newUser(0);
    const s = await createSeries(db, userId, wizard);
    await expect(createVideo(db, userId, s.id)).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(await listVideos(db, userId)).toEqual([]);
  });

  it("never goes below zero with simultaneous clicks", async () => {
    const userId = await newUser(3);
    const s = await createSeries(db, userId, wizard);
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => createVideo(db, userId, s.id)));

    const ok = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(3);
    expect(refused).toHaveLength(7);
    for (const r of refused) expect((r as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientCreditsError);
    expect(await getCreditBalance(db, userId)).toBe(0);
    expect(await listVideos(db, userId)).toHaveLength(3);
  });

  it("refunds a failed video exactly once", async () => {
    const userId = await newUser(1);
    const s = await createSeries(db, userId, wizard);
    const v = await createVideo(db, userId, s.id);
    expect(await getCreditBalance(db, userId)).toBe(0);

    expect(await failVideo(db, v.id, "ComfyUI out of memory")).toBe(true);
    expect(await failVideo(db, v.id, "again")).toBe(false);
    expect(await getCreditBalance(db, userId)).toBe(1);
    expect(await getVideo(db, userId, v.id)).toMatchObject({ status: "failed", error: "ComfyUI out of memory" });
  });

  it("refunds a video deleted while queued, but not one already produced", async () => {
    const userId = await newUser(2);
    const s = await createSeries(db, userId, wizard);
    const queued = await createVideo(db, userId, s.id);
    const ready = await createVideo(db, userId, s.id);
    await db.update(videos).set({ status: "ready" }).where(eq(videos.id, ready.id));
    expect(await getCreditBalance(db, userId)).toBe(0);

    expect(await deleteVideo(db, userId, queued.id)).toEqual({ refunded: true });
    expect(await deleteVideo(db, userId, ready.id)).toEqual({ refunded: false });
    expect(await getCreditBalance(db, userId)).toBe(1);
    expect(await listVideos(db, userId)).toEqual([]);
  });

  it("refunds the queued videos when their series is deleted", async () => {
    const userId = await newUser(2);
    const s = await createSeries(db, userId, wizard);
    await createVideo(db, userId, s.id);
    await createVideo(db, userId, s.id);
    await deleteSeries(db, userId, s.id);
    expect(await getCreditBalance(db, userId)).toBe(2);
    expect(await listVideos(db, userId)).toEqual([]);
  });

  it("keeps each user's videos private and filters by series", async () => {
    const a = await newUser(2, "pro"); // two series need a plan above Free
    const b = await newUser(1);
    const s1 = await createSeries(db, a, wizard);
    const s2 = await createSeries(db, a, { ...wizard, name: "Second" });
    const v = await createVideo(db, a, s1.id);
    await createVideo(db, a, s2.id);

    expect(await listVideos(db, a, { seriesId: s1.id })).toHaveLength(1);
    expect(await listVideos(db, b)).toEqual([]);
    await expect(getVideo(db, b, v.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteVideo(db, b, v.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await listVideos(db, a)).toHaveLength(2);
  });
});

describe("plan limits and paging", () => {
  it("Free and Starter allow 1 series, Growth 3 and Pro any number", async () => {
    const free = await newUser();
    await createSeries(db, free, wizard);
    await expect(createSeries(db, free, wizard)).rejects.toThrow("Your Free plan includes 1 series");

    const growth = await newUser(0, "growth");
    for (let i = 0; i < 3; i++) await createSeries(db, growth, { ...wizard, name: `G${i}` });
    await expect(createSeries(db, growth, wizard)).rejects.toBeInstanceOf(PlanLimitError);

    const pro = await newUser(0, "pro");
    for (let i = 0; i < 5; i++) await createSeries(db, pro, { ...wizard, name: `P${i}` });
    expect(await listSeries(db, pro)).toHaveLength(5);
    expect((await getMe(db, pro)).limits).toEqual({ series: null, seriesUsed: 5 });
    expect((await getMe(db, free)).limits).toEqual({ series: 1, seriesUsed: 1 });
  });

  it("simultaneous creations can't go over the limit, and deleting frees a slot", async () => {
    const free = await newUser();
    const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => createSeries(db, free, { ...wizard, name: `S${i}` })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [only] = await listSeries(db, free);
    await deleteSeries(db, free, only.id);
    expect((await createSeries(db, free, wizard)).name).toBe(wizard.name);
  });

  it("pages through all the videos with the cursor, newest first, without gaps or repeats", async () => {
    const userId = await newUser(0, "pro");
    const s = await createSeries(db, userId, wizard);
    // 120 videos, several sharing the same millisecond (ties are broken by id).
    const at = Date.UTC(2026, 10, 1);
    await db.insert(videos).values(
      Array.from({ length: 120 }, (_, i) => ({ seriesId: s.id, userId, title: `V${i}`, createdAt: new Date(at + Math.floor(i / 3) * 1000) })),
    );
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const batch = await listVideos(db, userId, { cursor, limit: 50 });
      seen.push(...batch.map((v) => v.id));
      if (batch.length < 50) break;
      cursor = videoCursor(batch[batch.length - 1]);
    }
    expect(seen).toHaveLength(120);
    expect(new Set(seen).size).toBe(120);
    const all = await listVideos(db, userId, { limit: 200 });
    expect(all.map((v) => v.id)).toEqual(seen); // same order as one big page
    expect(Date.parse(all[0].createdAt)).toBeGreaterThanOrEqual(Date.parse(all[119].createdAt));
    expect(await listVideos(db, userId, { cursor: "garbage" })).toHaveLength(50); // bad cursor = first page
  });
});

describe("account", () => {
  it("reports plan, balance and allowance", async () => {
    const userId = await newUser(60);
    expect(await getMe(db, userId)).toMatchObject({ plan: { id: "free", monthlyCredits: 60 }, credits: { balance: 60, allowance: 60 } });

    await db.insert(subscriptions).values({ userId, plan: "growth", status: "active" });
    expect(await getMe(db, userId)).toMatchObject({ plan: { id: "growth", monthlyCredits: 90 }, credits: { balance: 60, allowance: 90 } });
  });

  it("updates preferences and validates them", async () => {
    const userId = await newUser();
    const me = await updateAccount(db, userId, { timezone: "Europe/Prague", autoPublish: false, emailNotifications: false });
    expect(me.user).toMatchObject({ timezone: "Europe/Prague", autoPublish: false, emailNotifications: false });
    await expect(updateAccount(db, userId, { timezone: "Nowhere/City" })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateAccount(db, userId, { autoPublish: "yes" })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateAccount(db, userId, {})).rejects.toBeInstanceOf(ValidationError);
  });

  it("lists and disconnects only the user's own social accounts", async () => {
    const a = await newUser();
    const b = await newUser();
    const [conn] = await db
      .insert(socialConnections)
      .values({ userId: a, platform: "youtube", externalAccountId: "UC1", username: "@a", accessTokenEnc: "v1:x:y:z" })
      .returning();
    expect((await getMe(db, a)).connections).toEqual([{ id: conn.id, platform: "youtube", username: "@a", status: "active" }]);
    await expect(deleteConnection(db, b, conn.id)).rejects.toBeInstanceOf(NotFoundError);
    await deleteConnection(db, a, conn.id);
    expect((await getMe(db, a)).connections).toEqual([]);
  });
});
