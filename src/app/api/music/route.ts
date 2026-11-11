import { MAX_MUSIC_BYTES } from "@/server/audio-file";
import { TooLargeError } from "@/server/errors";
import { json, withUser } from "@/server/http";
import { listMusic, readBodyLimited, uploadMusic } from "@/server/music";
import { musicDeps } from "@/server/music-deps";

export const dynamic = "force-dynamic";

/** GET /api/music — the user's music library, with signed playback links. */
export const GET = () => withUser(async (userId) => json(await listMusic(musicDeps(), userId)));

/**
 * POST /api/music — uploads one MP3/WAV file (up to 10 MB) as the raw request body.
 * The original file name goes in the X-File-Name header (URI-encoded). → 201 track.
 */
export const POST = (req: Request) =>
  withUser(async (userId) => {
    const declared = Number(req.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_MUSIC_BYTES) throw new TooLargeError("The file is larger than 10 MB.");
    const bytes = await readBodyLimited(req.body, MAX_MUSIC_BYTES);
    let fileName: string | null = null;
    try {
      fileName = decodeURIComponent(req.headers.get("x-file-name") ?? "");
    } catch {
      fileName = null;
    }
    return json(await uploadMusic(musicDeps(), userId, { bytes, fileName }), 201);
  });
