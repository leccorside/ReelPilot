// Narration timing on the CPU (Passo 7): how long Kokoro takes per video, per language.
// Run in the worker container with the "ai" profile up:
//   docker compose exec worker npx tsx scripts/tts-bench.ts
import { env } from "@/lib/env";
import { kokoroTtsProvider } from "@/worker/providers/kokoro-tts";

const SAMPLES: Record<string, string[]> = {
  en: [
    "This lighthouse moved half a mile inland, and almost nobody noticed.",
    "In nineteen ninety-nine, engineers lifted the whole tower onto steel rails.",
    "Then they pushed it, a few feet at a time, for twenty-three days.",
    "The sea had been eating the cliff for a century, and the tower was next.",
    "Today it stands safely in a field, still shining every single night.",
    "Its keepers say the light looks different now, quieter, almost relieved.",
    "Would you have believed a building could walk away from the ocean?",
  ],
  pt: ["Este farol mudou de lugar sem que ninguém percebesse.", "A história começa em mil oitocentos e noventa, numa ilha esquecida.", "Os faroleiros juravam que a luz se movia sozinha durante as tempestades."],
  es: ["Este faro cambió de lugar sin que nadie lo notara.", "La historia empieza en el siglo diecinueve, en una isla olvidada.", "Los fareros juraban que la luz se movía sola durante las tormentas."],
  fr: ["Ce phare a changé de place sans que personne ne le remarque.", "L'histoire commence au dix-neuvième siècle, sur une île oubliée.", "Les gardiens juraient que la lumière bougeait seule pendant les tempêtes."],
  it: ["Questo faro ha cambiato posto senza che nessuno se ne accorgesse.", "La storia inizia nell'Ottocento, su un'isola dimenticata.", "I guardiani giuravano che la luce si muoveva da sola durante le tempeste."],
  hi: ["यह प्रकाश स्तंभ बिना किसी को पता चले अपनी जगह बदल गया।", "कहानी उन्नीसवीं सदी में एक भूले हुए द्वीप पर शुरू होती है।", "रखवाले कसम खाते थे कि तूफ़ानों में रोशनी अपने आप चलती थी।"],
};

async function main() {
  const tts = kokoroTtsProvider({ baseUrl: env().KOKORO_URL });
  await tts.speak({ scenes: ["Warm up."], voice: "adam", language: "en" }); // first call loads the voice
  for (const [language, scenes] of Object.entries(SAMPLES)) {
    const words = scenes.join(" ").split(/\s+/).length;
    const t0 = Date.now();
    const n = await tts.speak({ scenes, voice: "bella", language });
    const ms = Date.now() - t0;
    const rtf = ms / n.durationMs;
    console.log(
      `${language}: ${words} words, ${scenes.length} scenes -> ${(n.durationMs / 1000).toFixed(1)} s of audio in ${(ms / 1000).toFixed(1)} s ` +
        `(x${rtf.toFixed(2)} real time; a 45 s narration ~ ${((45 * rtf)).toFixed(0)} s), ${n.words.length} word times`,
    );
  }
}

void main();
