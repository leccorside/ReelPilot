import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";
import { ValidationError } from "./errors";
import { KOKORO_SAMPLE_RATE } from "./kokoro";
import { verifyMediaSignature } from "./media-url";
import { createStorage, deleteObjects, getObject } from "./storage";
import { VoicePreviewUnavailable, voicePreviewUrl } from "./voice-preview";

// The wizard's voice preview against the real S3 of docker-compose and a scripted Kokoro.
// The previews live in the shared bucket: the test deletes the two it uses before and after, and
// the app regenerates them on the next preview.
const e = env();
const storage = createStorage({ endpoint: e.S3_ENDPOINT, region: e.S3_REGION, accessKey: e.S3_ACCESS_KEY, secretKey: e.S3_SECRET_KEY, bucket: e.S3_BUCKET });
const secret = randomUUID().repeat(2);

function kokoro(ok = true) {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    if (!ok) throw new TypeError("fetch failed");
    const pcm = new Uint8Array(KOKORO_SAMPLE_RATE * 2); // one second
    return new Response(JSON.stringify({ audio: Buffer.from(pcm).toString("base64"), timestamps: [{ word: "Olá", start_time: 0, end_time: 0.5 }] }));
  }) as unknown as typeof fetch;
  return { fetchImpl, calls: () => calls };
}

describe("voice preview", () => {
  it("is generated once, stored, and then served from storage through a signed link", async () => {
    const key = "previews/voices/v1/it-marcus.wav";
    await deleteObjects(storage, [key]);
    const k = kokoro();
    try {
      const url = await voicePreviewUrl({ storage, kokoroUrl: "http://kokoro:8880", secret, fetchImpl: k.fetchImpl }, "marcus", "it");
      expect(url).toMatch(/^\/api\/media\/previews\/voices\/v1\/it-marcus\.wav\?exp=\d+&sig=/);
      const u = new URL(url, "http://x");
      expect(verifyMediaSignature(secret, key, u.searchParams.get("exp"), u.searchParams.get("sig"))).toEqual({ ok: true });
      const stored = await getObject(storage, key);
      expect(stored?.ContentType).toBe("audio/wav");
      expect(stored?.ContentLength).toBe(44 + KOKORO_SAMPLE_RATE * 2);

      await voicePreviewUrl({ storage, kokoroUrl: "http://kokoro:8880", secret, fetchImpl: k.fetchImpl }, "marcus", "it");
      expect(k.calls()).toBe(1); // second time: no new generation
    } finally {
      await deleteObjects(storage, [key]);
    }
  });

  it("refuses unknown voices and languages, and says when the voice service is down", async () => {
    const deps = { storage, kokoroUrl: "http://kokoro:8880", secret, fetchImpl: kokoro(false).fetchImpl };
    await expect(voicePreviewUrl(deps, "darth", "en")).rejects.toBeInstanceOf(ValidationError);
    await expect(voicePreviewUrl(deps, "adam", "de")).rejects.toBeInstanceOf(ValidationError);
    await deleteObjects(storage, ["previews/voices/v1/hi-nova.wav"]);
    await expect(voicePreviewUrl(deps, "nova", "hi")).rejects.toBeInstanceOf(VoicePreviewUnavailable);
  });
});
