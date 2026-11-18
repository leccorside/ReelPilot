import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import { series, videoSteps, videos, type VideoScript } from "@/server/db/schema";
import { deletePrefix, getObject, keys, listKeys, putObject, type Storage } from "@/server/storage";
import { UNFINISHED } from "@/server/videos";
import { ProviderError, type Providers, type SeriesBrief, type WordTiming } from "./providers/types";
import { renderVideo } from "./render";

// The video pipeline: script → voice → images → render. Each step stores its result (step output
// in video_steps, files in S3) before the next one starts, and a step that already succeeded is
// never run again. So a retry, or a worker killed mid-video and restarted, picks up exactly where
// it stopped, and the credit charged when the video was created is never charged again.

export const STEPS = [
  { name: "script", status: "scripting", label: "Writing the script" },
  { name: "voice", status: "voicing", label: "Recording the voice" },
  { name: "images", status: "imaging", label: "Creating the images" },
  { name: "render", status: "rendering", label: "Putting the video together" },
] as const;

type Step = (typeof STEPS)[number];
export type StepName = Step["name"];

type ScriptOut = { script: VideoScript; model: string };
type VoiceOut = { audioKey: string; durationMs: number; sceneDurationsMs: number[]; words: WordTiming[] };
/** `drawn`: images made in the attempt that finished the step (the rest came from earlier attempts). */
type ImagesOut = { imageKeys: string[]; drawn: number };

/** The same seed for every scene of a video (a consistent look), different between videos. */
export function videoSeed(videoId: string): number {
  return Number.parseInt(videoId.replace(/-/g, "").slice(0, 12), 16) || 1; // 48 bits, safe as a JS number
}
type RenderOut = { videoKey: string; thumbnailKey: string; durationMs: number };
type Outputs = { script?: ScriptOut; voice?: VoiceOut; images?: ImagesOut; render?: RenderOut };

export type PipelineDeps = {
  db: Db;
  storage: Storage;
  providers: Providers;
  /** Scratch folder of this worker; each video gets a subfolder, removed when it ends. */
  tmpRoot: string;
  /** ffmpeg threads per video (ffmpegThreads()); unset = ffmpeg decides. */
  ffmpegThreads?: number;
};

/** The video was deleted (or finished elsewhere) while it was being made: stop quietly. */
export class VideoGone extends Error {}

/**
 * A step failed. The message is shown to the customer, so it says which step, in plain words.
 * `retryable: false` (from a ProviderError) makes the queue fail the video at once.
 */
export class StepError extends Error {
  constructor(
    readonly step: StepName,
    message: string,
    readonly retryable = true,
  ) {
    super(message);
  }
}

/** What a step returns: its output (saved in video_steps) and, for paid APIs, what it cost. */
type StepResult = { output: Record<string, unknown>; costMicroUsd?: number };

type Ctx = {
  videoId: string;
  seriesId: string;
  userId: string;
  prefix: string;
  brief: SeriesBrief;
  dir: string;
  out: Outputs;
};

/**
 * Makes one video. Returns "ready", or "skipped" when there was nothing to do (deleted, already
 * finished, failed). Throws StepError when a step fails (the queue retries it).
 */
export async function processVideo(deps: PipelineDeps, videoId: string): Promise<"ready" | "skipped"> {
  const { db } = deps;
  const [row] = await db
    .select({ video: videos, series })
    .from(videos)
    .innerJoin(series, eq(series.id, videos.seriesId))
    .where(eq(videos.id, videoId));
  if (!row || !UNFINISHED.includes(row.video.status)) return "skipped";

  const done = await db.select().from(videoSteps).where(and(eq(videoSteps.videoId, videoId), eq(videoSteps.status, "succeeded")));
  const out: Outputs = {};
  for (const s of done) (out as Record<string, unknown>)[s.step] = s.output;

  const dir = await mkdtemp(join(deps.tmpRoot, `${videoId}-`));
  const ctx: Ctx = {
    videoId,
    seriesId: row.video.seriesId,
    userId: row.video.userId,
    prefix: keys.video(row.video.userId, videoId),
    brief: {
      name: row.series.name,
      niche: row.series.niche,
      formats: row.series.formats,
      language: row.series.language,
      voice: row.series.voice,
      artStyle: row.series.artStyle,
    },
    dir,
    out,
  };

  try {
    for (const step of STEPS) {
      if (out[step.name]) continue; // already done in an earlier attempt
      await startStep(db, videoId, step);
      const started = Date.now();
      let result: StepResult;
      try {
        result = await RUN[step.name](deps, ctx);
      } catch (e) {
        if (e instanceof VideoGone) throw e;
        const reason = e instanceof Error ? e.message : String(e);
        const spent = e instanceof ProviderError ? e.costMicroUsd : 0;
        await db
          .update(videoSteps)
          .set({ status: "failed", error: reason.slice(0, 1000), finishedAt: new Date(), durationMs: Date.now() - started, costMicroUsd: sql`${videoSteps.costMicroUsd} + ${spent}` })
          .where(and(eq(videoSteps.videoId, videoId), eq(videoSteps.step, step.name)));
        const retryable = !(e instanceof ProviderError) || e.retryable;
        // A message written for the customer (declined topic, content rules) is shown as is.
        const message = e instanceof ProviderError && !e.retryable ? reason : `${step.label} failed: ${reason}`;
        throw new StepError(step.name, message.slice(0, 600), retryable);
      }
      await finishStep(db, videoId, step, result, Date.now() - started);
      (out as Record<string, unknown>)[step.name] = result.output;
    }

    const r = out.render!;
    const [ready] = await db
      .update(videos)
      .set({ status: "ready", videoKey: r.videoKey, thumbnailKey: r.thumbnailKey, audioKey: out.voice!.audioKey, durationMs: r.durationMs, error: null })
      .where(and(eq(videos.id, videoId), eq(videos.status, "rendering")))
      .returning({ id: videos.id });
    if (!ready) throw new VideoGone();
    return "ready";
  } catch (e) {
    if (!(e instanceof VideoGone)) throw e;
    // Deleted while being made: remove whatever this run uploaded after the delete cleaned up.
    const [still] = await db.select({ id: videos.id }).from(videos).where(eq(videos.id, videoId));
    if (!still) await deletePrefix(deps.storage, ctx.prefix).catch(() => {});
    return "skipped";
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Moves the video to the step's status and records the attempt. Throws VideoGone if it can't go on. */
async function startStep(db: Db, videoId: string, step: Step) {
  await db.transaction(async (tx) => {
    const [v] = await tx
      .update(videos)
      .set({ status: step.status, error: null })
      .where(and(eq(videos.id, videoId), inArray(videos.status, UNFINISHED)))
      .returning({ id: videos.id });
    if (!v) throw new VideoGone();
    const now = new Date();
    await tx
      .insert(videoSteps)
      .values({ videoId, step: step.name, status: "running", attempts: 1, startedAt: now })
      .onConflictDoUpdate({
        target: [videoSteps.videoId, videoSteps.step],
        set: { status: "running", attempts: sql`${videoSteps.attempts} + 1`, startedAt: now, finishedAt: null, error: null },
      });
  });
}

async function finishStep(db: Db, videoId: string, step: Step, result: StepResult, durationMs: number) {
  const [saved] = await db
    .update(videoSteps)
    // Added to what earlier, failed attempts already spent: every call is paid for.
    .set({ status: "succeeded", output: result.output, costMicroUsd: sql`${videoSteps.costMicroUsd} + ${result.costMicroUsd ?? 0}`, finishedAt: new Date(), durationMs, error: null })
    .where(and(eq(videoSteps.videoId, videoId), eq(videoSteps.step, step.name)))
    .returning({ id: videoSteps.id });
  if (!saved) throw new VideoGone(); // the row went with the deleted video
}

async function download(deps: PipelineDeps, key: string, file: string) {
  const obj = await getObject(deps.storage, key);
  if (!obj?.Body) throw new Error(`stored file is missing (${key.split("/").pop()})`);
  await writeFile(file, await obj.Body.transformToByteArray());
}

/** Topics of the series' earlier videos (newest first), so the script doesn't repeat them. */
async function usedTopics(db: Db, seriesId: string, exceptVideoId: string): Promise<string[]> {
  const rows = await db
    .select({ topic: sql<string | null>`${videos.script}->>'topic'` })
    .from(videos)
    .where(and(eq(videos.seriesId, seriesId), ne(videos.id, exceptVideoId), isNotNull(videos.script)))
    .orderBy(desc(videos.createdAt))
    .limit(60);
  return [...new Set(rows.map((r) => r.topic?.trim()).filter((t): t is string => !!t))];
}

const RUN: Record<StepName, (deps: PipelineDeps, ctx: Ctx) => Promise<StepResult>> = {
  async script(deps, ctx) {
    const { script, costMicroUsd, model } = await deps.providers.script.write(ctx.brief, { usedTopics: await usedTopics(deps.db, ctx.seriesId, ctx.videoId) });
    if (!script.scenes?.length) throw new Error("the script has no scenes");
    const [v] = await deps.db.update(videos).set({ script }).where(eq(videos.id, ctx.videoId)).returning({ id: videos.id });
    if (!v) throw new VideoGone();
    return { output: { script, model } satisfies ScriptOut, costMicroUsd };
  },

  async voice(deps, ctx) {
    const scenes = ctx.out.script!.script.scenes.map((s) => s.narration);
    const n = await deps.providers.tts.speak({ scenes, voice: ctx.brief.voice, language: ctx.brief.language });
    if (n.sceneDurationsMs.length !== scenes.length) throw new Error(`the narration has ${n.sceneDurationsMs.length} parts for ${scenes.length} scenes`);
    const audioKey = `${ctx.prefix}voice.${n.mimeType === "audio/wav" ? "wav" : "mp3"}`;
    await putObject(deps.storage, audioKey, n.audio, n.mimeType);
    return { output: { audioKey, durationMs: n.durationMs, sceneDurationsMs: n.sceneDurationsMs, words: n.words } satisfies VoiceOut };
  },

  async images(deps, ctx) {
    const scenes = ctx.out.script!.script.scenes.map((s) => s.visual);
    // Each image is stored as soon as it is drawn: after a failure, only the missing ones are redrawn.
    const stored = new Set(await listKeys(deps.storage, `${ctx.prefix}images/`));
    const seed = videoSeed(ctx.videoId);
    const imageKeys: string[] = [];
    let drawn = 0;
    for (const [i, visual] of scenes.entries()) {
      const already = ["png", "jpg"].map((ext) => `${ctx.prefix}images/scene-${i + 1}.${ext}`).find((k) => stored.has(k));
      if (already) {
        imageKeys.push(already);
        continue;
      }
      // Each image takes GPU time: stop as soon as the customer deletes the video.
      const [still] = await deps.db.select({ id: videos.id }).from(videos).where(eq(videos.id, ctx.videoId));
      if (!still) throw new VideoGone();
      const img = await deps.providers.images.draw({ visual, artStyle: ctx.brief.artStyle, seed, index: i, workDir: ctx.dir });
      const key = `${ctx.prefix}images/scene-${i + 1}.${img.mimeType === "image/png" ? "png" : "jpg"}`;
      await putObject(deps.storage, key, img.data, img.mimeType);
      imageKeys.push(key);
      drawn++;
    }
    return { output: { imageKeys, drawn } satisfies ImagesOut };
  },

  async render(deps, ctx) {
    const { audioKey, sceneDurationsMs } = ctx.out.voice!;
    const audio = join(ctx.dir, `voice${audioKey.slice(audioKey.lastIndexOf("."))}`);
    await download(deps, audioKey, audio);
    const images: string[] = [];
    for (const [i, key] of ctx.out.images!.imageKeys.entries()) {
      const file = join(ctx.dir, `scene-${i + 1}${key.slice(key.lastIndexOf("."))}`);
      await download(deps, key, file);
      images.push(file);
    }
    const outFile = join(ctx.dir, "video.mp4");
    const thumbFile = join(ctx.dir, "thumbnail.jpg");
    const { durationMs } = await renderVideo({ images, sceneDurationsMs, audio, outFile, thumbFile, threads: deps.ffmpegThreads });
    const videoKey = `${ctx.prefix}video.mp4`;
    const thumbnailKey = `${ctx.prefix}thumbnail.jpg`;
    await putObject(deps.storage, videoKey, new Uint8Array(await readFile(outFile)), "video/mp4");
    await putObject(deps.storage, thumbnailKey, new Uint8Array(await readFile(thumbFile)), "image/jpeg");
    return { output: { videoKey, thumbnailKey, durationMs } satisfies RenderOut };
  },
};

/** The message saved on a video that failed for good (shown in the dashboard next to "Credit refunded"). */
export function failureMessage(reason: string | undefined, attempts: number): string {
  if (!reason) return "Something went wrong while making this video.";
  if (/stalled more than allowable limit/i.test(reason)) return "The video engine stopped several times while making this video.";
  return attempts > 1 ? `${reason} (tried ${attempts} times)` : reason;
}
