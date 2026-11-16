import type { VideoScript } from "@/server/db/schema";

// What each step of the pipeline needs from the outside world. Every provider has a fake
// implementation (./fake.ts) used in tests and in development without the AI services. Real ones:
// script = Claude API (./claude-script.ts, Passo 6); voice = Kokoro (Passo 7); images = ComfyUI (Passo 8).

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

export type ScriptResult = {
  script: VideoScript;
  /** Estimated cost of the calls that produced it, in millionths of a dollar (0 for fakes). */
  costMicroUsd: number;
  /** Which model wrote it ("fake" for the fake provider). */
  model: string;
};

export interface ScriptProvider {
  /** `usedTopics`: subjects of the series' earlier videos, not to be repeated. */
  write(brief: SeriesBrief, opts?: { usedTopics?: string[] }): Promise<ScriptResult>;
}

export interface TtsProvider {
  speak(input: { scenes: string[]; voice: string; language: string }): Promise<Narration>;
}

export interface ImageProvider {
  /** One vertical image per scene, in order. `workDir` is a scratch folder of this video. */
  draw(input: { scenes: string[]; artStyle: string; workDir: string }): Promise<SceneImage[]>;
}

export type Providers = { script: ScriptProvider; tts: TtsProvider; images: ImageProvider };

/**
 * A provider failure. `retryable: false` means trying again can't help (the AI declined the topic,
 * the content breaks the platforms' rules, the API key is wrong): the video fails at once, with
 * the credit refunded, instead of using up its attempts.
 */
export class ProviderError extends Error {
  /** What the failed attempt already spent (paid API calls before the failure), in millionths of a dollar. */
  costMicroUsd = 0;

  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
