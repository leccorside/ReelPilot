import { db } from "@/server/db";
import { json, withUser } from "@/server/http";
import { listVideos } from "@/server/videos";

export const dynamic = "force-dynamic";

/**
 * GET /api/videos?seriesId=…&cursor=…&limit=… — the user's videos, newest first, 50 per page.
 * For the next page pass cursor=<createdAt>_<id> of the last video received.
 */
export const GET = (req: Request) =>
  withUser(async (userId) => {
    const params = new URL(req.url).searchParams;
    const limit = Number(params.get("limit"));
    return json(
      await listVideos(db(), userId, {
        seriesId: params.get("seriesId") ?? undefined,
        cursor: params.get("cursor") ?? undefined,
        limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      }),
    );
  });
