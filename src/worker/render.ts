import { ffmpeg, probe } from "./ffmpeg";

// Puts the video together: each scene image is shown for as long as its narration lasts, scaled
// and cropped to 1080x1920, with the narration as the soundtrack. H.264/AAC MP4 with "faststart"
// (plays while downloading) plus a JPEG thumbnail. Zoom/pan, transitions, captions and music come
// in Passo 9; this is the base they build on.

export const OUTPUT = { width: 1080, height: 1920, fps: 30 } as const;

export async function renderVideo(input: {
  images: string[];
  sceneDurationsMs: number[];
  audio: string;
  outFile: string;
  thumbFile: string;
  /**
   * Threads for ffmpeg. Inside a container ffmpeg sees every host core and starts ~1.5 threads per
   * core for each video; several videos at once on a 2-CPU quota were throttled to 30-60 s each
   * (1-2 s alone) and filled the memory limit. See ffmpegThreads().
   */
  threads?: number;
}): Promise<{ durationMs: number }> {
  const { images, sceneDurationsMs, audio, outFile, thumbFile } = input;
  if (images.length === 0 || images.length !== sceneDurationsMs.length) {
    throw new Error(`render needs one duration per image (got ${images.length} images and ${sceneDurationsMs.length} durations)`);
  }
  const { width: w, height: h, fps } = OUTPUT;
  const threads = String(input.threads ?? 0); // 0 = ffmpeg decides (it sees every host core)
  const args: string[] = ["-filter_threads", threads];
  images.forEach((img, i) => args.push("-loop", "1", "-t", (sceneDurationsMs[i] / 1000).toFixed(3), "-i", img));
  args.push("-i", audio);
  const scaled = images
    .map((_, i) => `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=${fps},format=yuv420p[v${i}]`)
    .join(";");
  const concat = `${images.map((_, i) => `[v${i}]`).join("")}concat=n=${images.length}:v=1:a=0[v]`;
  args.push(
    "-filter_complex", `${scaled};${concat}`,
    "-map", "[v]",
    "-map", `${images.length}:a`,
    "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-crf", "23", "-pix_fmt", "yuv420p", "-threads", threads,
    "-c:a", "aac", "-b:a", "128k",
    "-shortest",
    "-movflags", "+faststart",
    outFile,
  );
  await ffmpeg(args);
  await ffmpeg(["-ss", "0.3", "-i", outFile, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "4", thumbFile], 60_000);

  const info = await probe(outFile);
  if (info.video?.width !== w || info.video?.height !== h) throw new Error(`render produced ${info.video?.width}x${info.video?.height}, expected ${w}x${h}`);
  return { durationMs: info.durationMs };
}
