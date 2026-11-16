import { describe, expect, it } from "vitest";
import { KOKORO_LANG, kokoroVoice, PREVIEW_TEXT } from "@/lib/voices";
import { LANGUAGES, VOICES } from "@/lib/options";
import { evenWords, KOKORO_SAMPLE_RATE } from "@/server/kokoro";
import { kokoroTtsProvider, SCENE_PAUSE_MS } from "./kokoro-tts";
import { ProviderError } from "./types";

// The Kokoro narration provider against a scripted fetch that answers like Kokoro-FastAPI v0.9.2
// (/dev/captioned_speech: base64 PCM + word timestamps in seconds, punctuation as separate tokens).

/** Voices installed in kokoro-fastapi-cpu v0.9.2 (GET /v1/audio/voices, 2026-11-16), the ones mapped. */
const INSTALLED = ["am_michael", "am_puck", "af_bella", "af_heart", "am_fenrir", "em_alex", "ef_dora", "pm_alex", "pf_dora", "ff_siwis", "im_nicola", "if_sara", "hm_omega", "hm_psi", "hf_alpha", "hf_beta"];

const pcmOf = (ms: number) => new Uint8Array(Math.round((ms * KOKORO_SAMPLE_RATE) / 1000) * 2).fill(7);

type Answer = { ms: number; timestamps?: { word: string; start_time: number; end_time: number }[] | null } | { status: number; body?: string } | "down";
function kokoro(answers: Answer[]) {
  const bodies: Record<string, unknown>[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    const a = answers.shift();
    if (!a || a === "down") throw new TypeError("fetch failed");
    if ("status" in a) return new Response(a.body ?? "", { status: a.status });
    return new Response(JSON.stringify({ audio: Buffer.from(pcmOf(a.ms)).toString("base64"), audio_format: "audio/pcm", timestamps: a.timestamps }), { status: 200 });
  }) as unknown as typeof fetch;
  return { provider: kokoroTtsProvider({ baseUrl: "http://kokoro:8880", fetchImpl }), bodies };
}

describe("voice mapping", () => {
  it("every narrator has an installed Kokoro voice in every language of the wizard; German is gone", () => {
    expect(LANGUAGES.map((l) => l.id)).not.toContain("de");
    for (const l of LANGUAGES) {
      expect(KOKORO_LANG[l.id], l.id).toBeDefined();
      expect(PREVIEW_TEXT[l.id], l.id).toBeTruthy();
      for (const v of VOICES) expect(INSTALLED, `${v.id}/${l.id}`).toContain(kokoroVoice(v.id, l.id)!.voice);
    }
    expect(kokoroVoice("adam", "de")).toBeNull();
  });
});

describe("Kokoro narration", () => {
  it("speaks each scene, joins them with a short pause and moves the word times into place", async () => {
    const k = kokoro([
      { ms: 2000, timestamps: [{ word: "Here", start_time: -0.0002, end_time: 0.4 }, { word: "it", start_time: 0.4, end_time: 0.9 }, { word: ".", start_time: 0.9, end_time: 1 }] },
      { ms: 1500, timestamps: [{ word: "Then", start_time: 0.1, end_time: 0.6 }, { word: "gone!", start_time: 0.6, end_time: 1.62 }] },
    ]);
    const n = await k.provider.speak({ scenes: ["Here it.", "Then gone!"], voice: "bella", language: "pt" });

    expect(k.bodies).toHaveLength(2);
    expect(k.bodies[0]).toMatchObject({ input: "Here it.", voice: "pf_dora", lang_code: "p", speed: 0.95, response_format: "pcm", return_timestamps: true, stream: false });
    expect(n.sceneDurationsMs).toEqual([2000 + SCENE_PAUSE_MS, 1500]);
    expect(n.durationMs).toBe(2000 + SCENE_PAUSE_MS + 1500);
    expect(n.sceneDurationsMs.reduce((a, b) => a + b, 0)).toBe(n.durationMs);
    // Punctuation tokens dropped, negative start clamped to 0, second scene shifted by 2,250 ms.
    expect(n.words).toEqual([
      { word: "Here", startMs: 0, endMs: 400 },
      { word: "it", startMs: 400, endMs: 900 },
      { word: "Then", startMs: 2350, endMs: 2850 },
      { word: "gone!", startMs: 2850, endMs: 3750 }, // 1.62 s overshoots the 1.5 s audio: clamped
    ]);
    // A real WAV with the exact size in its header.
    const wav = Buffer.from(n.audio);
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.readUInt32LE(40)).toBe(wav.length - 44);
    expect(wav.readUInt32LE(24)).toBe(24_000);
  });

  it("without word times the words are spread evenly, so captions still follow", async () => {
    const n = await kokoro([{ ms: 1000, timestamps: null }]).provider.speak({ scenes: ["One two, three — four"], voice: "adam", language: "en" });
    expect(n.words.map((w) => w.word)).toEqual(["One", "two,", "three", "four"]);
    expect(n.words.at(-1)?.endMs).toBe(1000);
    expect(evenWords("", 500)).toEqual([]);
  });

  it("errors: service down or overloaded is retried; a rejected text or a missing language is final", async () => {
    const speak = (answers: Answer[], language = "en") => kokoro(answers).provider.speak({ scenes: ["Hello there."], voice: "adam", language }).catch((e) => e);
    expect(await speak(["down"])).toMatchObject({ retryable: true, message: "the voice service could not be reached" });
    expect(await speak([{ status: 503 }])).toMatchObject({ retryable: true });
    const rejected = await speak([{ status: 400, body: '{"detail":"Input contains no speakable text"}' }]);
    expect(rejected).toBeInstanceOf(ProviderError);
    expect(rejected).toMatchObject({ retryable: false, message: expect.stringContaining("no speakable text") });
    expect(await speak([], "de")).toMatchObject({ retryable: false, message: "Narration in this series' language isn't available yet. Change the series' language and try again." });
  });
});
