import { kokoroVoice } from "@/lib/voices";
import { KOKORO_SAMPLE_RATE, KokoroError, kokoroSpeak, pcmToWav } from "@/server/kokoro";
import { ProviderError, type TtsProvider, type WordTiming } from "./types";

// Narration with Kokoro (Passo 7). Each scene is spoken by its own request, so the scene lengths
// come straight from the audio (the images follow them exactly), with a short pause between scenes.
// The scenes are joined into one WAV, and the word times are moved to their place in it.

/** Silence after each scene (except the last): a breath between ideas, and a clean cut for the images. */
export const SCENE_PAUSE_MS = 250;

export function kokoroTtsProvider(opts: { baseUrl: string; fetchImpl?: typeof fetch }): TtsProvider {
  return {
    async speak({ scenes, voice, language }) {
      const v = kokoroVoice(voice, language);
      if (!v) throw new ProviderError(`Narration in this series' language isn't available yet. Change the series' language and try again.`, false);

      const parts: Uint8Array[] = [];
      const sceneDurationsMs: number[] = [];
      const words: WordTiming[] = [];
      let offsetMs = 0;
      for (const [i, text] of scenes.entries()) {
        let speech;
        try {
          speech = await kokoroSpeak(opts.baseUrl, text, v, { fetchImpl: opts.fetchImpl });
        } catch (e) {
          if (e instanceof KokoroError) throw new ProviderError(e.message, e.retryable);
          throw e;
        }
        const pauseMs = i < scenes.length - 1 ? SCENE_PAUSE_MS : 0;
        parts.push(speech.pcm, silence(pauseMs));
        for (const w of speech.words) words.push({ word: w.word, startMs: w.startMs + offsetMs, endMs: w.endMs + offsetMs });
        // The exact length of what was added (samples), so scenes and audio never drift apart.
        const sceneMs = Math.round(msOf(speech.pcm.length + bytes(pauseMs)));
        sceneDurationsMs.push(sceneMs);
        offsetMs += sceneMs;
      }
      const pcm = concat(parts);
      return { audio: pcmToWav(pcm), mimeType: "audio/wav", durationMs: Math.round(msOf(pcm.length)), sceneDurationsMs, words };
    },
  };
}

/** Bytes of `ms` of 24 kHz 16-bit mono audio (whole samples), and back (24 samples per millisecond). */
const bytes = (ms: number) => Math.round((ms * KOKORO_SAMPLE_RATE) / 1000) * 2;
const msOf = (byteCount: number) => byteCount / 2 / (KOKORO_SAMPLE_RATE / 1000);

function silence(ms: number): Uint8Array {
  return new Uint8Array(bytes(ms));
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
