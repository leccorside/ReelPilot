import { env } from "@/lib/env";
import { json, jsonError, withUser } from "@/server/http";
import { storage } from "@/server/storage";
import { VoicePreviewUnavailable, voicePreviewUrl } from "@/server/voice-preview";

export const dynamic = "force-dynamic";

/**
 * GET /api/voices/preview?voice=adam&language=pt → { url } (signed link to a short WAV of that
 * narrator). 400 for an unknown voice or language; 503 when the voice service is down.
 */
export const GET = (req: Request) =>
  withUser(async () => {
    const q = new URL(req.url).searchParams;
    try {
      const e = env();
      return json({ url: await voicePreviewUrl({ storage: storage(), kokoroUrl: e.KOKORO_URL, secret: e.AUTH_SECRET }, q.get("voice") ?? "", q.get("language") ?? "") });
    } catch (err) {
      if (err instanceof VoicePreviewUnavailable) return jsonError(503, err.message);
      throw err;
    }
  });
