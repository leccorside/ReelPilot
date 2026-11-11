import { db } from "@/server/db";
import { json, withUser } from "@/server/http";
import { cleanupAfterCommit, deletePrefix, keys, storage } from "@/server/storage";
import { deleteVideo, getVideo } from "@/server/videos";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** GET /api/videos/:id */
export const GET = (_req: Request, { params }: Ctx) => withUser(async (userId) => json(await getVideo(db(), userId, params.id)));

/** DELETE /api/videos/:id → { refunded } (true when it was still waiting in the queue). Its files go too. */
export const DELETE = (_req: Request, { params }: Ctx) =>
  withUser(async (userId) => {
    const result = await deleteVideo(db(), userId, params.id);
    await cleanupAfterCommit(() => deletePrefix(storage(), keys.video(userId, params.id)), `video ${params.id}`);
    return json(result);
  });
