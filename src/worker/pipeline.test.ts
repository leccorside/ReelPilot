import { rm } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createDb } from "@/server/db";
import { videos } from "@/server/db/schema";
import { keys, listKeys } from "@/server/storage";
import { createVideo, deleteVideo, failVideo } from "@/server/videos";
import { ffmpegThreads, probe } from "./ffmpeg";
import { failureMessage, processVideo, StepError, type PipelineDeps } from "./pipeline";
import { FAKE_MS_PER_WORD, fakeProviders, fakeScript } from "./providers/fake";
import { ProviderError, type Providers } from "./providers/types";
import { credits, downloadTo, newVideo, stepRows, testStorage, testTmpRoot, videoRow } from "./test-helpers";
import { silentWav } from "./wav";

// The pipeline against the real test database, the real S3 and real ffmpeg, with fake providers.
const { db, client } = createDb(inject("testDatabaseUrl"), { max: 6 });
const storage = testStorage();
let tmpRoot = "";
const deps = (providers: Providers = fakeProviders()): PipelineDeps => ({ db, storage, providers, tmpRoot });

beforeAll(async () => {
  tmpRoot = await testTmpRoot();
});
afterAll(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
  await client.end({ timeout: 5 });
});

/** Fake providers that count calls and can fail a step a given number of times. */
function counting(failImages = 0) {
  const base = fakeProviders();
  const calls = { script: 0, tts: 0, images: 0 };
  const providers: Providers = {
    script: { write: (b) => (calls.script++, base.script.write(b)) },
    tts: { speak: (i) => (calls.tts++, base.tts.speak(i)) },
    images: {
      draw: async (i) => {
        calls.images++;
        if (calls.images <= failImages) throw new Error("GPU out of memory");
        return base.images.draw(i);
      },
    },
  };
  return { providers, calls };
}

describe("ffmpeg threads", () => {
  it("splits the container's CPU quota between the videos made at once, never below one", () => {
    expect(ffmpegThreads(2, 2)).toBe(1);
    expect(ffmpegThreads(2, 8)).toBe(4);
    expect(ffmpegThreads(4, 2)).toBe(1);
    expect(ffmpegThreads(1, 1.5)).toBe(1);
  });
});

describe("fake providers", () => {
  it("narration lasts as long as its words, scene by scene, as a valid WAV", async () => {
    const scenes = fakeScript({ name: "S", niche: "Deep sea creatures", formats: [], language: "en", voice: "adam", artStyle: "realism" }).scenes;
    const n = await fakeProviders().tts.speak({ scenes: scenes.map((s) => s.narration), voice: "adam", language: "en" });
    const words = scenes.flatMap((s) => s.narration.split(/\s+/));
    expect(n.words).toHaveLength(words.length);
    expect(n.sceneDurationsMs).toHaveLength(scenes.length);
    expect(n.sceneDurationsMs.reduce((a, b) => a + b, 0)).toBe(n.durationMs);
    expect(n.durationMs).toBe(words.length * FAKE_MS_PER_WORD);
    expect(Buffer.from(n.audio.slice(0, 4)).toString("ascii")).toBe("RIFF");
    expect(n.audio.length).toBe(silentWav(n.durationMs).length);
  });
});

// Real ffmpeg renders: allow for a busy machine.
describe("video pipeline", { timeout: 90_000 }, () => {
  it("makes a real 1080x1920 MP4 with a thumbnail, step by step, for the credit charged once", async () => {
    const { userId, videoId } = await newVideo(db);
    expect(await processVideo(deps(), videoId)).toBe("ready");

    const v = await videoRow(db, videoId);
    expect(v).toMatchObject({ status: "ready", error: null });
    expect(v.videoKey).toBe(`${keys.video(userId, videoId)}video.mp4`);
    expect(v.script?.scenes.length).toBe(4);

    const file = await downloadTo(v.videoKey!, tmpRoot, `${videoId}.mp4`);
    const info = await probe(file);
    expect(info.video).toEqual({ codec: "h264", width: 1080, height: 1920 });
    expect(info.audio?.codec).toBe("aac");
    const steps = await stepRows(db, videoId);
    const narration = (steps.voice.output as { durationMs: number }).durationMs;
    expect(Math.abs(info.durationMs - narration)).toBeLessThan(400);
    expect(v.durationMs).toBe(info.durationMs);

    expect(await probe(await downloadTo(v.thumbnailKey!, tmpRoot, `${videoId}.jpg`))).toMatchObject({ video: { width: 540, height: 960 } });
    for (const name of ["script", "voice", "images", "render"]) expect(steps[name]).toMatchObject({ status: "succeeded", attempts: 1 });
    expect(await credits(db, userId, videoId)).toEqual({ debits: 1, refunds: 0, balance: 4 });
  });

  it("a retry resumes at the failed step: finished steps are not redone and nothing is charged again", async () => {
    const { userId, videoId } = await newVideo(db);
    const { providers, calls } = counting(1);

    const first = await processVideo(deps(providers), videoId).catch((e) => e);
    expect(first).toBeInstanceOf(StepError);
    expect(first.message).toBe("Creating the images failed: GPU out of memory");
    expect((await videoRow(db, videoId)).status).toBe("imaging");
    let steps = await stepRows(db, videoId);
    expect(steps.script.status).toBe("succeeded");
    expect(steps.voice.status).toBe("succeeded");
    expect(steps.images).toMatchObject({ status: "failed", attempts: 1, error: "GPU out of memory" });

    expect(await processVideo(deps(providers), videoId)).toBe("ready");
    expect(calls).toEqual({ script: 1, tts: 1, images: 2 });
    steps = await stepRows(db, videoId);
    expect(steps.images).toMatchObject({ status: "succeeded", attempts: 2 });
    expect(steps.render).toMatchObject({ status: "succeeded", attempts: 1 });
    expect(await credits(db, userId, videoId)).toEqual({ debits: 1, refunds: 0, balance: 4 });
  });

  it("stops when the video is deleted while being made, and leaves no files behind", async () => {
    const { userId, videoId } = await newVideo(db);
    const base = fakeProviders();
    const providers: Providers = {
      ...base,
      images: {
        draw: async (i) => {
          await deleteVideo(db, userId, videoId); // the customer deletes it mid-way
          return base.images.draw(i);
        },
      },
    };
    expect(await processVideo(deps(providers), videoId)).toBe("skipped");
    expect(await videoRow(db, videoId)).toBeUndefined();
    expect(await listKeys(storage, keys.video(userId, videoId))).toEqual([]);
    // Deleted before it was finished: the credit came back (5 - 1 + 1). The ledger rows stay,
    // unlinked from the deleted video (video_id is set to null), so none match it any more.
    expect(await credits(db, userId, videoId)).toEqual({ debits: 0, refunds: 0, balance: 5 });
  });

  it("does nothing for videos that are finished, failed or gone", async () => {
    const { videoId } = await newVideo(db);
    await failVideo(db, videoId, "boom");
    expect(await processVideo(deps(), videoId)).toBe("skipped");
    const other = await newVideo(db);
    await db.update(videos).set({ status: "ready" }).where(eq(videos.id, other.videoId));
    expect(await processVideo(deps(), other.videoId)).toBe("skipped");
    expect(await processVideo(deps(), "00000000-0000-4000-8000-000000000000")).toBe("skipped");
  });

  it("the script step gets the series' earlier topics and records the cost of every attempt", async () => {
    const { userId, seriesId, videoId } = await newVideo(db);
    const seen: string[][] = [];
    let fail = true;
    const base = fakeProviders();
    const providers: Providers = {
      ...base,
      script: {
        write: async (b, o) => {
          seen.push(o?.usedTopics ?? []);
          if (fail) {
            fail = false;
            throw Object.assign(new ProviderError("the script service is busy (rate limited)", true), { costMicroUsd: 300 });
          }
          return { script: { ...fakeScript(b), topic: `Topic ${seen.length}` }, costMicroUsd: 7200, model: "claude-sonnet-5-5" };
        },
      },
    };
    expect(await processVideo(deps(providers), videoId).catch((e) => e.message)).toBe("Writing the script failed: the script service is busy (rate limited)");
    expect(await processVideo(deps(providers), videoId)).toBe("ready");
    expect((await stepRows(db, videoId)).script).toMatchObject({ attempts: 2, costMicroUsd: 7500, output: { model: "claude-sonnet-5-5" } });

    // The next video of the same series is told what was covered.
    const next = await createVideo(db, userId, seriesId);
    expect(await processVideo(deps(providers), next.id)).toBe("ready");
    expect(seen.at(-1)).toEqual(["Topic 2"]);
  });

  it("a provider failure that can't be fixed by retrying is marked as final, with the customer's message as is", async () => {
    const { videoId } = await newVideo(db);
    const declined = "The AI declined to write a script for this series. Change the series' niche and try again.";
    const providers: Providers = { ...fakeProviders(), script: { write: async () => Promise.reject(new ProviderError(declined, false)) } };
    const err = await processVideo(deps(providers), videoId).catch((e) => e);
    expect(err).toBeInstanceOf(StepError);
    expect(err).toMatchObject({ retryable: false, message: declined });
  });

  it("explains final failures in plain words", () => {
    expect(failureMessage("Recording the voice failed: Kokoro is not answering", 3)).toBe("Recording the voice failed: Kokoro is not answering (tried 3 times)");
    expect(failureMessage("job stalled more than allowable limit", 2)).toBe("The video engine stopped several times while making this video.");
    expect(failureMessage(undefined, 1)).toBe("Something went wrong while making this video.");
  });
});
