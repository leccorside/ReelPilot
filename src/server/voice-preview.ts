import { kokoroVoice, PREVIEW_TEXT } from "@/lib/voices";
import { ValidationError } from "@/server/errors";
import { KokoroError, kokoroSpeak, pcmToWav } from "@/server/kokoro";
import { signMediaPath } from "@/server/media-url";
import { keys, objectExists, putObject, type Storage } from "@/server/storage";

// The wizard's voice preview (Passo 7): the real narrator, not the browser's voice. Each voice and
// language is generated once by Kokoro and kept in storage (at most 5 voices x 6 languages), so a
// preview after the first one is just a signed link.

export class VoicePreviewUnavailable extends Error {}

export type VoicePreviewDeps = { storage: Storage; kokoroUrl: string; secret: string; fetchImpl?: typeof fetch };

/** A signed link (30 min) to the preview of `voice` in `language`; generated on first use. */
export async function voicePreviewUrl(deps: VoicePreviewDeps, voice: string, language: string): Promise<string> {
  const v = kokoroVoice(voice, language);
  const text = PREVIEW_TEXT[language];
  if (!v || !text) throw new ValidationError("There's no preview for this voice and language.");

  const key = keys.voicePreview(language, voice);
  if (!(await objectExists(deps.storage, key))) {
    try {
      const speech = await kokoroSpeak(deps.kokoroUrl, text, v, { timeoutMs: 30_000, fetchImpl: deps.fetchImpl });
      await putObject(deps.storage, key, pcmToWav(speech.pcm), "audio/wav");
    } catch (e) {
      if (e instanceof KokoroError) throw new VoicePreviewUnavailable("Voice previews are unavailable right now. Please try again in a moment.");
      throw e;
    }
  }
  return signMediaPath(deps.secret, key);
}
