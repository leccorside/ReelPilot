// Narrator voices (Passo 7): each voice of the wizard, in each language, mapped to a Kokoro voice.
// Kokoro (v0.9.2) has these languages and voices; picks follow its own quality grades
// (/v1/audio/voices), e.g. "am_adam" is graded F+, so the wizard's Adam uses "am_michael" (C+).
// German is not available in Kokoro, so it is not offered in the wizard.

export type KokoroLang = "a" | "e" | "p" | "f" | "i" | "h";

type VoiceId = "adam" | "alex" | "bella" | "nova" | "marcus";

/** Kokoro's language code for each wizard language. */
export const KOKORO_LANG: Record<string, KokoroLang> = { en: "a", es: "e", pt: "p", fr: "f", it: "i", hi: "h" };

const KOKORO_VOICES: Record<KokoroLang, Record<VoiceId, string>> = {
  a: { adam: "am_michael", alex: "am_puck", bella: "af_bella", nova: "af_heart", marcus: "am_fenrir" },
  e: { adam: "em_alex", alex: "em_alex", bella: "ef_dora", nova: "ef_dora", marcus: "em_alex" },
  p: { adam: "pm_alex", alex: "pm_alex", bella: "pf_dora", nova: "pf_dora", marcus: "pm_alex" },
  // French has a single (female) Kokoro voice: every narrator uses it, at its own pace.
  f: { adam: "ff_siwis", alex: "ff_siwis", bella: "ff_siwis", nova: "ff_siwis", marcus: "ff_siwis" },
  i: { adam: "im_nicola", alex: "im_nicola", bella: "if_sara", nova: "if_sara", marcus: "im_nicola" },
  h: { adam: "hm_omega", alex: "hm_psi", bella: "hf_alpha", nova: "hf_beta", marcus: "hm_omega" },
};

/** Speaking pace of each narrator (Kokoro "speed"); voices shared within a language still sound different. */
const SPEED: Record<VoiceId, number> = { adam: 1, alex: 1.1, bella: 0.95, nova: 1.12, marcus: 0.9 };

/** Languages that only have one narrator voice (the wizard says so). */
export const SINGLE_VOICE_LANGUAGES = ["fr"];

export type KokoroVoice = { voice: string; lang: KokoroLang; speed: number };

/** The Kokoro voice for a wizard voice and language, or null when the language has no narration. */
export function kokoroVoice(voice: string, language: string): KokoroVoice | null {
  const lang = KOKORO_LANG[language];
  if (!lang || !(voice in SPEED)) return null;
  return { voice: KOKORO_VOICES[lang][voice as VoiceId], lang, speed: SPEED[voice as VoiceId] };
}

/** What each narrator says in the wizard's voice preview. */
export const PREVIEW_TEXT: Record<string, string> = {
  en: "Hi! I'll be the voice of your videos. Here's a story you won't forget.",
  es: "¡Hola! Seré la voz de tus videos. Aquí tienes una historia que no vas a olvidar.",
  pt: "Olá! Eu vou ser a voz dos seus vídeos. Aqui vai uma história que você não vai esquecer.",
  fr: "Bonjour ! Je serai la voix de vos vidéos. Voici une histoire que vous n'oublierez pas.",
  it: "Ciao! Sarò la voce dei tuoi video. Ecco una storia che non dimenticherai.",
  // Gender-neutral wording: the same sentence is read by male and female voices.
  hi: "नमस्ते! आपके वीडियो में आवाज़ मेरी होगी। सुनिए एक ऐसी कहानी जो आप कभी नहीं भूलेंगे।",
};
