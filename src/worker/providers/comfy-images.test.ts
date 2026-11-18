import { describe, expect, it } from "vitest";
import { buildWorkflow, comfyImageProvider, imagePrompt } from "./comfy-images";
import { ProviderError } from "./types";

// The ComfyUI provider against a scripted ComfyUI: HTTP (/prompt, /free, /interrupt) and the websocket.

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
/** A binary websocket frame as ComfyUI sends it: event type (1), image format (2 = PNG), image. */
const frame = (img: Uint8Array) => {
  const out = new Uint8Array(8 + img.length);
  new DataView(out.buffer).setUint32(0, 1);
  new DataView(out.buffer).setUint32(4, 2);
  out.set(img, 8);
  return out.buffer;
};

type Run = "ok" | "oom" | "error" | "silent" | { status: number };
function comfy(runs: Run[]) {
  const calls: { path: string; body?: Record<string, any> }[] = [];
  let socket: FakeWs | null = null;
  class FakeWs {
    binaryType = "";
    onopen: ((ev: unknown) => void) | null = null;
    onmessage: ((ev: { data: unknown }) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    onclose: ((ev: unknown) => void) | null = null;
    constructor(readonly url: string) {
      socket = this;
      setTimeout(() => this.onopen?.({}), 0);
    }
    close() {}
  }
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (path !== "/prompt") return new Response("{}");
    const run = runs.shift() ?? "ok";
    if (typeof run === "object") return new Response('{"error":{"type":"value_not_in_list"}}', { status: run.status });
    const id = `p${calls.length}`;
    const ws = socket!;
    setTimeout(() => {
      const send = (data: unknown) => ws.onmessage?.({ data });
      if (run === "ok") {
        send(JSON.stringify({ type: "executing", data: { node: "9", prompt_id: id } }));
        send(frame(PNG));
        send(JSON.stringify({ type: "executing", data: { node: null, prompt_id: id } }));
      } else if (run === "oom") {
        send(JSON.stringify({ type: "execution_error", data: { prompt_id: id, exception_type: "torch.OutOfMemoryError", exception_message: "CUDA out of memory. Tried to allocate 1.2 GiB" } }));
      } else if (run === "error") {
        send(JSON.stringify({ type: "execution_error", data: { prompt_id: id, exception_type: "RuntimeError", exception_message: "boom" } }));
      } // "silent": never answers
    }, 1);
    return new Response(JSON.stringify({ prompt_id: id }));
  }) as unknown as typeof fetch;
  const provider = (timeoutMs?: number) => comfyImageProvider({ baseUrl: "http://comfyui:8188", fetchImpl, WebSocketImpl: FakeWs as never, timeoutMs, log: () => {} });
  return { provider, calls, wsUrl: () => socket?.url };
}

const scene = { visual: "A lighthouse on a cliff at dusk.", artStyle: "lego", seed: 123456789, index: 0, workDir: "/tmp" };

describe("ComfyUI images", () => {
  it("sends the workflow with the scene, the style and the video's seed, and returns the PNG from the websocket", async () => {
    const c = comfy(["ok"]);
    const img = await c.provider().draw(scene);
    expect(img).toEqual({ data: PNG, mimeType: "image/png" });
    expect(c.wsUrl()).toMatch(/^ws:\/\/comfyui:8188\/ws\?clientId=[0-9a-f-]{36}$/);
    const wf = c.calls[0].body!.prompt;
    expect(wf["4"].inputs.text).toBe(imagePrompt(scene.visual, "lego"));
    expect(wf["4"].inputs.text).toContain("plastic toy construction bricks");
    expect(wf["4"].inputs.text).not.toMatch(/lego|disney|ghibli/i);
    expect(wf["7"].inputs).toMatchObject({ seed: 123456789, steps: 4, cfg: 1 });
    expect(wf["9"].class_type).toBe("SaveImageWebsocket");
    // T5 on the CPU: with it on the GPU, FLUX was swapped out for every image (~136 s each on the RTX 3060).
    expect(wf["2"].inputs.device).toBe("cpu");
    expect(wf._comment).toBeUndefined();
  });

  it("out of GPU memory: frees the GPU and tries that image once more", async () => {
    const c = comfy(["oom", "ok"]);
    expect(await c.provider().draw(scene)).toMatchObject({ mimeType: "image/png" });
    expect(c.calls.map((x) => x.path)).toEqual(["/prompt", "/free", "/prompt"]);
    expect(c.calls[1].body).toEqual({ unload_models: true, free_memory: true });

    const twice = await comfy(["oom", "oom"]).provider().draw(scene).catch((e) => e);
    expect(twice).toMatchObject({ retryable: true, message: "the GPU ran out of memory (is something else using it?)" });
  });

  it("a model failure is retried by the queue; a rejected workflow (missing model) is final and not shown verbatim", async () => {
    expect(await comfy(["error"]).provider().draw(scene).catch((e) => e)).toMatchObject({ retryable: true, message: "the image model failed (RuntimeError boom)" });
    const errors: string[] = [];
    const orig = console.error;
    console.error = (m: string) => errors.push(m);
    try {
      const rejected = await comfy([{ status: 400 }]).provider().draw(scene).catch((e) => e);
      expect(rejected).toBeInstanceOf(ProviderError);
      expect(rejected).toMatchObject({ retryable: false, message: "The image service is unavailable right now. Your credit is back; please try again later." });
      expect(errors[0]).toContain("ACTION NEEDED: ComfyUI rejected the workflow (400)");
    } finally {
      console.error = orig;
    }
  });

  it("too slow: interrupts ComfyUI and fails the attempt", async () => {
    const c = comfy(["silent"]);
    const err = await c.provider(50).draw(scene).catch((e) => e);
    expect(err).toMatchObject({ retryable: true, message: "the image took longer than 0 s" });
    expect(c.calls.map((x) => x.path)).toEqual(["/prompt", "/interrupt"]);
  });

  it("builds a fresh workflow every time (the template is never changed)", () => {
    const a = buildWorkflow("first", 1) as Record<string, any>;
    const b = buildWorkflow("second", 2) as Record<string, any>;
    expect([a["4"].inputs.text, b["4"].inputs.text, a["7"].inputs.seed]).toEqual(["first", "second", 1]);
  });
});
