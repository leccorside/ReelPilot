import type { KokoroVoice } from "@/lib/voices";

// Client of the Kokoro-FastAPI service (container "kokoro", CPU, profile "ai"), used by the worker's
// narration step and by the wizard's voice preview.
//
// It calls /dev/captioned_speech, which returns the audio and the time of every word. The audio is
// requested as raw PCM (24 kHz, 16-bit, mono) because Kokoro's WAV comes with an "unknown size"
// header (streaming style); pcmToWav() adds a correct one.

export const KOKORO_SAMPLE_RATE = 24_000;

export class KokoroError extends Error {
  constructor(
    message: string,
    /** Retrying can help (service down or overloaded), unlike a rejected text. */
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export type KokoroWord = { word: string; startMs: number; endMs: number };
export type KokoroSpeech = { pcm: Uint8Array; durationMs: number; words: KokoroWord[] };

/** Speaks `text`; word times are relative to the start of this audio. */
export async function kokoroSpeak(baseUrl: string, text: string, v: KokoroVoice, opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<KokoroSpeech> {
  const doFetch = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${baseUrl.replace(/\/$/, "")}/dev/captioned_speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ model: "kokoro", input: text, voice: v.voice, lang_code: v.lang, speed: v.speed, response_format: "pcm", stream: false, return_timestamps: true }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
    });
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    throw new KokoroError(timeout ? "the voice service took too long" : "the voice service could not be reached", true);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // 4xx: Kokoro rejected this text or voice (retrying the same input can't help).
    throw new KokoroError(`the voice service rejected the text (${res.status}${body ? `: ${body.slice(0, 200)}` : ""})`, res.status >= 500 || res.status === 429);
  }
  const data = (await res.json()) as { audio?: string; timestamps?: { word: string; start_time: number; end_time: number }[] | null };
  const pcm = new Uint8Array(Buffer.from(data.audio ?? "", "base64"));
  if (pcm.length < 2) throw new KokoroError("the voice service returned no audio", true);
  const durationMs = Math.round((pcm.length / 2 / KOKORO_SAMPLE_RATE) * 1000);

  // Words only (punctuation comes as separate tokens), clamped to the audio (times can overshoot a little).
  const clamp = (s: number) => Math.min(durationMs, Math.max(0, Math.round(s * 1000)));
  let words = (data.timestamps ?? [])
    .filter((t) => /[\p{L}\p{N}]/u.test(t.word))
    .map((t) => ({ word: t.word, startMs: clamp(t.start_time), endMs: clamp(t.end_time) }));
  // No timings (shouldn't happen: every language was checked on 2026-11-16): spread the words evenly
  // so the captions still follow the voice roughly.
  if (words.length === 0) words = evenWords(text, durationMs);
  return { pcm, durationMs, words };
}

export function evenWords(text: string, durationMs: number): KokoroWord[] {
  const list = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const step = list.length ? durationMs / list.length : 0;
  return list.map((word, i) => ({ word, startMs: Math.round(i * step), endMs: Math.round((i + 1) * step) }));
}

/** 16-bit mono PCM at Kokoro's rate as a WAV file. */
export function pcmToWav(pcm: Uint8Array, sampleRate = KOKORO_SAMPLE_RATE): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const v = new DataView(out.buffer);
  const text = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

/** Health of the voice service (for the preview route's error message). */
export async function kokoroReady(baseUrl: string): Promise<boolean> {
  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}
