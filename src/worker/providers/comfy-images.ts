import { randomUUID } from "node:crypto";
import workflowTemplate from "../../../docker/comfyui/workflows/flux-schnell.json";
import { ART_STYLES } from "@/lib/options";
import { ProviderError, type ImageProvider, type SceneImage } from "./types";

// Scene images from ComfyUI + FLUX.1-schnell on the GPU (Passo 8).
//   - The workflow is versioned in docker/comfyui/workflows/flux-schnell.json; prompt and seed are filled in.
//   - The image comes back over ComfyUI's websocket (SaveImageWebsocket), so nothing piles up on its disk.
//   - ComfyUI runs one prompt at a time, so the GPU makes one image at a time whatever the worker does.
//   - Out of GPU memory: ask ComfyUI to unload its models (/free) and try that image once more.
//   - Too slow: /interrupt and fail the attempt (the queue retries; images already made are kept).

/**
 * Per image, including the wait in ComfyUI's queue. Generous because the first image after ComfyUI
 * starts also loads ~13 GB of models: on this PC they sit on a USB SSD (drive E:, inside Docker's
 * .vhdx) and took ~4.8 min to load (measured 2026-11-16). Warm images take seconds.
 */
export const IMAGE_TIMEOUT_MS = 15 * 60_000;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

/** The text sent to the image model: the scene, then the series' style, then what to avoid. */
export function imagePrompt(visual: string, artStyle: string): string {
  const style = ART_STYLES.find((s) => s.id === artStyle)?.prompt ?? ART_STYLES[0].prompt;
  return `${visual.trim().replace(/\.$/, "")}. ${style}. Vertical 9:16 composition, no text, no letters, no watermark, no logo.`;
}

/** The API-format workflow for one image. */
export function buildWorkflow(prompt: string, seed: number): Record<string, unknown> {
  const wf = JSON.parse(JSON.stringify(workflowTemplate)) as Record<string, { inputs: Record<string, unknown> }> & { _comment?: string };
  delete wf._comment;
  wf["4"].inputs.text = prompt;
  wf["7"].inputs.seed = seed;
  return wf;
}

type WsLike = {
  binaryType: string;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  close(): void;
};

export type ComfyOptions = {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  WebSocketImpl?: new (url: string) => WsLike;
  log?: (msg: string) => void;
};

class OutOfMemory extends Error {}

export function comfyImageProvider(opts: ComfyOptions): ImageProvider {
  const base = opts.baseUrl.replace(/\/$/, "");
  const doFetch = opts.fetchImpl ?? fetch;
  const Ws = opts.WebSocketImpl ?? (globalThis.WebSocket as unknown as new (url: string) => WsLike);
  const log = opts.log ?? ((m: string) => console.log(`[images] ${m}`));

  async function once(prompt: string, seed: number): Promise<SceneImage> {
    const clientId = randomUUID();
    const ws = new Ws(`${base.replace(/^http/, "ws")}/ws?clientId=${clientId}`);
    ws.binaryType = "arraybuffer";
    try {
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new ProviderError("the image service could not be reached", true));
      });

      let promptId = "";
      let image: Uint8Array | null = null;
      const done = new Promise<void>((resolve, reject) => {
        ws.onmessage = (ev) => {
          if (typeof ev.data !== "string") {
            // Binary frame: 4 bytes event type, 4 bytes image format, then the image (SaveImageWebsocket).
            const bytes = new Uint8Array(ev.data as ArrayBuffer);
            if (bytes.length > 8) image = bytes.subarray(8);
            return;
          }
          const msg = JSON.parse(ev.data) as { type: string; data: { prompt_id?: string; node?: string | null; exception_message?: string; exception_type?: string } };
          if (promptId && msg.data?.prompt_id && msg.data.prompt_id !== promptId) return;
          if (msg.type === "execution_error") {
            const text = `${msg.data.exception_type ?? ""} ${msg.data.exception_message ?? ""}`.trim();
            reject(/out of memory|OutOfMemory|allocation on device/i.test(text) ? new OutOfMemory(text) : new ProviderError(`the image model failed (${text.slice(0, 200)})`, true));
          } else if (msg.type === "executing" && msg.data.node === null && msg.data.prompt_id === promptId) {
            resolve();
          }
        };
        ws.onclose = () => reject(new ProviderError("the image service closed the connection", true));
      });

      const res = await doFetch(`${base}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildWorkflow(prompt, seed), client_id: clientId }),
      }).catch(() => {
        throw new ProviderError("the image service could not be reached", true);
      });
      if (!res.ok) {
        // A missing model or node is our setup, not something a retry fixes.
        const body = await res.text().catch(() => "");
        console.error(`[images] ACTION NEEDED: ComfyUI rejected the workflow (${res.status}): ${body.slice(0, 500)}`);
        throw new ProviderError("The image service is unavailable right now. Your credit is back; please try again later.", false);
      }
      promptId = ((await res.json()) as { prompt_id: string }).prompt_id;

      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ProviderError(`the image took longer than ${Math.round((opts.timeoutMs ?? IMAGE_TIMEOUT_MS) / 1000)} s`, true)), opts.timeoutMs ?? IMAGE_TIMEOUT_MS);
      });
      try {
        await Promise.race([done, timeout]);
      } catch (e) {
        if (e instanceof ProviderError && /longer than/.test(e.message)) await doFetch(`${base}/interrupt`, { method: "POST" }).catch(() => {});
        throw e;
      } finally {
        clearTimeout(timer);
      }

      const img = image as Uint8Array | null;
      if (!img || !PNG_SIGNATURE.every((b, i) => img[i] === b)) throw new ProviderError("the image service returned no image", true);
      return { data: img, mimeType: "image/png" };
    } finally {
      ws.onclose = null;
      ws.close();
    }
  }

  return {
    async draw({ visual, artStyle, seed, index }) {
      const prompt = imagePrompt(visual, artStyle);
      try {
        return await once(prompt, seed);
      } catch (e) {
        if (!(e instanceof OutOfMemory)) throw e;
        // Free the GPU (models unloaded, caches emptied) and try this image once more.
        log(`scene ${index + 1}: out of GPU memory, freeing it and trying again`);
        await doFetch(`${base}/free`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unload_models: true, free_memory: true }) }).catch(() => {});
        try {
          return await once(prompt, seed);
        } catch (again) {
          if (again instanceof OutOfMemory) throw new ProviderError("the GPU ran out of memory (is something else using it?)", true);
          throw again;
        }
      }
    },
  };
}
