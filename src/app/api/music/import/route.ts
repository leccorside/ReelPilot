import { json, readJson, withUser } from "@/server/http";
import { importMusic } from "@/server/music";
import { musicDeps } from "@/server/music-deps";

export const dynamic = "force-dynamic";

/** POST /api/music/import — { url } of an MP3/WAV file (https, up to 10 MB) → 201 track. */
export const POST = (req: Request) => withUser(async (userId) => json(await importMusic(musicDeps(), userId, await readJson(req)), 201));
