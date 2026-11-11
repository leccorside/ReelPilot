import { db } from "@/server/db";
import { json, withUser } from "@/server/http";
import { deleteVideo, getVideo } from "@/server/videos";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** GET /api/videos/:id */
export const GET = (_req: Request, { params }: Ctx) => withUser(async (userId) => json(await getVideo(db(), userId, params.id)));

/** DELETE /api/videos/:id → { refunded } (true when it was still waiting in the queue). */
export const DELETE = (_req: Request, { params }: Ctx) => withUser(async (userId) => json(await deleteVideo(db(), userId, params.id)));
