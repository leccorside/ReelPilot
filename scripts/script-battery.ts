// Live check of the Claude script provider (Passo 6): 5 formats x 3 languages, real API calls.
// COSTS MONEY (about US$ 0.03-0.06 per script). Run inside the worker container, which has the key:
//   docker compose exec worker npx tsx scripts/script-battery.ts [out.json]
import { writeFile } from "node:fs/promises";
import { env } from "@/lib/env";
import { claudeScriptProvider, countWords, scriptProblems } from "@/worker/providers/claude-script";
import type { SeriesBrief } from "@/worker/providers/types";

const NICHES: Record<string, string> = {
  storytelling: "Strange true stories from old lighthouses and their keepers",
  top5: "The most unusual animals of the deep ocean",
  howto: "Simple kitchen tricks that save time when cooking at home",
  facts: "Surprising facts about the human brain",
  quiz: "World geography questions for curious people",
};
const LANGUAGES = ["en", "pt", "hi"];

async function main() {
  const e = env();
  if (!e.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set in this container");
  const provider = claudeScriptProvider({ model: e.CLAUDE_SCRIPT_MODEL, reviewModel: e.CLAUDE_REVIEW_MODEL, effort: e.CLAUDE_SCRIPT_EFFORT });
  const jobs = Object.entries(NICHES).flatMap(([format, niche]) => LANGUAGES.map((language) => ({ format, niche, language })));
  const results: Record<string, unknown>[] = [];

  // Three at a time.
  for (let i = 0; i < jobs.length; i += 3) {
    await Promise.all(
      jobs.slice(i, i + 3).map(async ({ format, niche, language }) => {
        const brief: SeriesBrief = { name: `Battery ${format}`, niche, formats: [format], language, voice: "adam", artStyle: "realism" };
        const started = Date.now();
        try {
          const r = await provider.write(brief);
          const words = r.script.scenes.reduce((n, s) => n + countWords(s.narration), 0);
          const devanagari = /[ऀ-ॿ]/.test(r.script.scenes.map((s) => s.narration).join(" "));
          const row = {
            format, language, ok: true, model: r.model, ms: Date.now() - started, costUsd: r.costMicroUsd / 1e6,
            words, scenes: r.script.scenes.length, problems: scriptProblems(r.script, [format]), formatUsed: r.script.format,
            hindiScript: language === "hi" ? devanagari : undefined, script: r.script,
          };
          results.push(row);
          console.log(`OK   ${format.padEnd(12)} ${language}  ${words} words, ${row.scenes} scenes, US$ ${row.costUsd.toFixed(4)}, ${(row.ms / 1000).toFixed(1)} s  "${r.script.title}"`);
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          results.push({ format, language, ok: false, ms: Date.now() - started, error: m, costUsd: ((err as { costMicroUsd?: number }).costMicroUsd ?? 0) / 1e6 });
          console.log(`FAIL ${format.padEnd(12)} ${language}  ${m}`);
        }
      }),
    );
  }

  // Repetition check: the same series again, told what it already covered.
  const first = results.find((r) => r.ok && r.format === "facts" && r.language === "en") as { script: { topic: string } } | undefined;
  if (first) {
    const again = await provider.write({ name: "Battery facts", niche: NICHES.facts, formats: ["facts"], language: "en", voice: "adam", artStyle: "realism" }, { usedTopics: [first.script.topic] });
    results.push({ repeatCheck: true, before: first.script.topic, after: again.script.topic, costUsd: again.costMicroUsd / 1e6 });
    console.log(`REPEAT  before: "${first.script.topic}"  after: "${again.script.topic}"`);
  }

  const ok = results.filter((r) => r.ok);
  const total = results.reduce((n, r) => n + ((r.costUsd as number) ?? 0), 0);
  console.log(`\n${ok.length}/${jobs.length} valid, total US$ ${total.toFixed(4)}, average US$ ${(total / results.length).toFixed(4)} per script`);
  await writeFile(process.argv[2] ?? "/tmp/script-battery.json", JSON.stringify(results, null, 2));
}

void main();
