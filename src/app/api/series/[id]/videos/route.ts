import { db } from "@/server/db";
import { json, withUser } from "@/server/http";
import { createVideo } from "@/server/videos";

export const dynamic = "force-dynamic";

/** POST /api/series/:id/videos — charges 1 credit and queues a new video → 201 video (402 without credits). */
export const POST = (_req: Request, { params }: { params: { id: string } }) =>
  withUser(async (userId) => json(await createVideo(db(), userId, params.id), 201));
