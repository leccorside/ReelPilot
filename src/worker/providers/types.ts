import type { VideoScript } from "@/server/db/schema";

// What each step of the pipeline needs from the outside world. Every provider has a fake
// implementation (./fake.ts) used in tests and in development without the AI services; the real
// ones arrive in Passo 6 (script, Claude API), 7 (voice, Kokoro) and 8 (images, ComfyUI + FLUX).

export type SeriesBrief = {
  name: string;
  niche: string;
  formats: string[];
  language: string;
  voice: string;
  artStyle: string;
};

export type WordTiming = { word: string; startMs: number; endMs: number };

export type Narration = {
  audio: Uint8Array;
  mimeType: "audio/wav" | "audio/mpeg";
  durationMs: number;
  /** How long each scene's narration lasts, in scene order (the images follow these). */
  sceneDurationsMs: number[];
  /** Time of every spoken word, for the animated captions (Passo 9). */
  words: WordTiming[];
};

export type SceneImage = { data: Uint8Array; mimeType: "image/png" | "image/jpeg" };

export interface ScriptProvider {
  write(brief: SeriesBrief): Promise<VideoScript>;
}

export interface TtsProvider {
  speak(input: { scenes: string[]; voice: string; language: string }): Promise<Narration>;
}

export interface ImageProvider {
  /** One vertical image per scene, in order. `workDir` is a scratch folder of this video. */
  draw(input: { scenes: string[]; artStyle: string; workDir: string }): Promise<SceneImage[]>;
}

export type Providers = { script: ScriptProvider; tts: TtsProvider; images: ImageProvider };
