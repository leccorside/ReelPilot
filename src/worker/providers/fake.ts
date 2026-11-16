import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { VideoScript } from "@/server/db/schema";
import { ffmpeg } from "../ffmpeg";
import { silentWav } from "../wav";
import type { ImageProvider, Providers, ScriptProvider, SeriesBrief, TtsProvider, WordTiming } from "./types";

// Fake providers: a fixed script, silent narration with evenly spaced words, and solid-color
// images. The render step is real ffmpeg, so the result is a real, playable MP4.
// `delayMs` pauses each step, so progress can be watched in the dashboard during development.

const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

/** Average speaking pace used to size the fake narration (about 2.6 words per second). */
export const FAKE_MS_PER_WORD = 380;

export function fakeScript(brief: SeriesBrief): VideoScript {
  const topic = brief.niche.trim().split(/\s+/).slice(0, 6).join(" ") || brief.name;
  return {
    topic: `A quick look at ${topic}`,
    format: brief.formats[0] ?? "facts",
    title: `${brief.name}: a quick look`,
    hook: `Here is something about ${topic} you probably didn't know.`,
    scenes: [
      { narration: `Here is something about ${topic} you probably didn't know.`, visual: `An eye-catching opening shot about ${topic}` },
      { narration: "It started small, almost by accident, and then everything changed.", visual: "A small beginning, warm light" },
      { narration: "Today people all over the world still talk about it.", visual: "A crowd from above, busy city" },
      { narration: "Follow for more stories like this one.", visual: "A calm closing shot" },
    ],
    caption: `Did you know this about ${topic}?`,
    hashtags: ["#shorts", "#facts"],
  };
}

export function fakeScriptProvider(delayMs = 0): ScriptProvider {
  return {
    async write(brief) {
      await sleep(delayMs);
      return { script: fakeScript(brief), costMicroUsd: 0, model: "fake" };
    },
  };
}

export function fakeTtsProvider(delayMs = 0): TtsProvider {
  return {
    async speak({ scenes }) {
      await sleep(delayMs);
      const words: WordTiming[] = [];
      const sceneDurationsMs: number[] = [];
      let t = 0;
      for (const scene of scenes) {
        const sceneWords = scene.split(/\s+/).filter(Boolean);
        const start = t;
        for (const word of sceneWords) {
          words.push({ word, startMs: t, endMs: t + FAKE_MS_PER_WORD - 40 });
          t += FAKE_MS_PER_WORD;
        }
        t = Math.max(t, start + 1000); // at least one second per scene
        sceneDurationsMs.push(t - start);
      }
      return { audio: silentWav(t), mimeType: "audio/wav", durationMs: t, sceneDurationsMs, words };
    },
  };
}

/** Distinct, readable colors for consecutive scenes. */
const COLORS = ["0x7c3aed", "0x2563eb", "0x059669", "0xd97706", "0xdc2626", "0x0891b2"];

export function fakeImageProvider(delayMs = 0): ImageProvider {
  return {
    async draw({ scenes, workDir }) {
      await sleep(delayMs);
      const out = [];
      for (let i = 0; i < scenes.length; i++) {
        const file = join(workDir, `fake-scene-${i + 1}.png`);
        // 768x1344: the size FLUX will generate in Passo 8 (the render step scales to 1080x1920).
        await ffmpeg(["-f", "lavfi", "-i", `color=c=${COLORS[i % COLORS.length]}:s=768x1344`, "-frames:v", "1", file], 60_000);
        out.push({ data: new Uint8Array(await readFile(file)), mimeType: "image/png" as const });
      }
      return out;
    },
  };
}

export function fakeProviders(delayMs = 0): Providers {
  return { script: fakeScriptProvider(delayMs), tts: fakeTtsProvider(delayMs), images: fakeImageProvider(delayMs) };
}
