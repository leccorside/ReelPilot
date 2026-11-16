import type { Env } from "@/lib/env";
import { claudeScriptProvider } from "./claude-script";
import { fakeProviders } from "./fake";
import type { Providers } from "./types";

/** The worker's providers, chosen by environment variables (the others stay fake until their step). */
export function createProviders(e: Env): Providers {
  const fakes = fakeProviders(e.FAKE_PROVIDER_DELAY_MS);
  const script =
    e.SCRIPT_PROVIDER === "claude"
      ? claudeScriptProvider({ model: e.CLAUDE_SCRIPT_MODEL, reviewModel: e.CLAUDE_REVIEW_MODEL, effort: e.CLAUDE_SCRIPT_EFFORT })
      : fakes.script;
  return { ...fakes, script };
}

export function describeProviders(e: Env): string {
  return `script=${e.SCRIPT_PROVIDER === "claude" ? `claude (${e.CLAUDE_SCRIPT_MODEL}, review ${e.CLAUDE_REVIEW_MODEL})` : "fake"}, voice=fake, images=fake`;
}
