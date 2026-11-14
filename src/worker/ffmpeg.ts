import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";

// ffmpeg and ffprobe (installed in the worker image) run as child processes with a time limit.
// On failure the error carries the last lines ffmpeg printed, which say what went wrong.

export class FfmpegError extends Error {}

function run(bin: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => {
      stderr += d;
      if (stderr.length > 20_000) stderr = stderr.slice(-10_000); // keep the end, where the error is
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new FfmpegError(`${bin} took longer than ${Math.round(timeoutMs / 1000)} s`));
    }, timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new FfmpegError(`${bin} could not start: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve(stdout);
      const tail = stderr.trim().split("\n").slice(-3).join(" | ");
      reject(new FfmpegError(`${bin} exited with code ${code}: ${tail}`));
    });
  });
}

/** CPUs this container may use (cgroup v2 quota, e.g. "200000 100000" = 2), or every core without a limit. */
export function cpuQuota(): number {
  try {
    const [max, period] = readFileSync("/sys/fs/cgroup/cpu.max", "utf8").trim().split(/\s+/);
    if (max !== "max" && Number(period) > 0) return Math.max(1, Number(max) / Number(period));
  } catch {
    // not Linux, or no cgroup v2: fall through
  }
  return availableParallelism();
}

/** Threads per ffmpeg so that `concurrency` videos at once share the CPU quota instead of fighting over it. */
export function ffmpegThreads(concurrency: number, quota = cpuQuota()): number {
  return Math.max(1, Math.floor(quota / Math.max(1, concurrency)));
}

export const ffmpeg = (args: string[], timeoutMs = 10 * 60_000) => run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], timeoutMs);

export type Probe = { durationMs: number; video?: { codec: string; width: number; height: number }; audio?: { codec: string } };

/** Duration and main streams of a media file. */
export async function probe(file: string): Promise<Probe> {
  const out = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", file], 60_000);
  const info = JSON.parse(out) as {
    format?: { duration?: string };
    streams?: { codec_type: string; codec_name: string; width?: number; height?: number }[];
  };
  const v = info.streams?.find((s) => s.codec_type === "video");
  const a = info.streams?.find((s) => s.codec_type === "audio");
  return {
    durationMs: Math.round(Number(info.format?.duration ?? 0) * 1000),
    video: v ? { codec: v.codec_name, width: v.width ?? 0, height: v.height ?? 0 } : undefined,
    audio: a ? { codec: a.codec_name } : undefined,
  };
}
