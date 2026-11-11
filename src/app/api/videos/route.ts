import { db } from "@/server/db";
import { json, withUser } from "@/server/http";
import { listVideos } from "@/server/videos";

export const dynamic = "force-dynamic";

/** GET /api/videos?seriesId=… — the user's videos, newest first (up to 100). */
export const GET = (req: Request) =>
  withUser(async (userId) => {
    const seriesId = new URL(req.url).searchParams.get("seriesId") ?? undefined;
    return json(await listVideos(db(), userId, { seriesId }));
  });
