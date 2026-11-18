import type { Env } from "@/lib/env";
import { claudeScriptProvider } from "./claude-script";
import { comfyImageProvider } from "./comfy-images";
import { fakeProviders } from "./fake";
import { kokoroTtsProvider } from "./kokoro-tts";
import type { Providers } from "./types";

/** The worker's providers, chosen by environment variables (the others stay fake until their step). */
export function createProviders(e: Env): Providers {
  const fakes = fakeProviders(e.FAKE_PROVIDER_DELAY_MS);
  return {
    ...fakes,
    script:
      e.SCRIPT_PROVIDER === "claude"
        ? claudeScriptProvider({ model: e.CLAUDE_SCRIPT_MODEL, reviewModel: e.CLAUDE_REVIEW_MODEL, effort: e.CLAUDE_SCRIPT_EFFORT })
        : fakes.script,
    tts: e.TTS_PROVIDER === "kokoro" ? kokoroTtsProvider({ baseUrl: e.KOKORO_URL }) : fakes.tts,
    images: e.IMAGE_PROVIDER === "comfyui" ? comfyImageProvider({ baseUrl: e.COMFYUI_URL }) : fakes.images,
  };
}

export function describeProviders(e: Env): string {
  const script = e.SCRIPT_PROVIDER === "claude" ? `claude (${e.CLAUDE_SCRIPT_MODEL}, review ${e.CLAUDE_REVIEW_MODEL})` : "fake";
  const voice = e.TTS_PROVIDER === "kokoro" ? `kokoro (${e.KOKORO_URL})` : "fake";
  const images = e.IMAGE_PROVIDER === "comfyui" ? `comfyui (${e.COMFYUI_URL})` : "fake";
  return `script=${script}, voice=${voice}, images=${images}`;
}
