// Image timing on the GPU (Passo 8): how long ComfyUI + FLUX.1-schnell takes per image, per style.
// Run in the worker container with the "ai" profile up (the images land in /tmp/image-bench):
//   docker compose exec worker npx tsx scripts/image-bench.ts
import { mkdir, writeFile } from "node:fs/promises";
import { env } from "@/lib/env";
import { ART_STYLES } from "@/lib/options";
import { comfyImageProvider } from "@/worker/providers/comfy-images";

const VISUALS = [
  "An old stone lighthouse on a rocky cliff at dusk, waves crashing below, warm light in the lantern room",
  "A lighthouse keeper's desk by a window, an oil lamp, a logbook and a brass telescope, rain outside",
  "A deep sea anglerfish glowing in the dark ocean, tiny bubbles around it",
  "A busy kitchen counter with chopped vegetables, a wooden board and a steaming pan",
];

async function main() {
  const out = "/tmp/image-bench";
  await mkdir(out, { recursive: true });
  const images = comfyImageProvider({ baseUrl: env().COMFYUI_URL });
  const seed = 424242;
  let i = 0;
  const times: number[] = [];
  for (const style of ART_STYLES) {
    const visual = VISUALS[i % VISUALS.length];
    const t0 = Date.now();
    const img = await images.draw({ visual, artStyle: style.id, seed, index: i, workDir: out });
    const ms = Date.now() - t0;
    times.push(ms);
    await writeFile(`${out}/${String(i + 1).padStart(2, "0")}-${style.id}.png`, img.data);
    console.log(`${String(i + 1).padStart(2)} ${style.name.padEnd(18)} ${(ms / 1000).toFixed(1)} s  ${(img.data.length / 1024).toFixed(0)} KB${i === 0 ? "  (cold start: loads the models)" : ""}`);
    i++;
  }
  const warm = times.slice(1);
  console.log(`\nwarm average ${(warm.reduce((a, b) => a + b, 0) / warm.length / 1000).toFixed(1)} s per image; a 6-scene video ~ ${((6 * warm.reduce((a, b) => a + b, 0)) / warm.length / 1000).toFixed(0)} s of images`);
}

void main();
