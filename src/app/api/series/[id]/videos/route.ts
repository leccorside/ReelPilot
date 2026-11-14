import { db } from "@/server/db";
import { json, withUser } from "@/server/http";
import { enqueueVideoWithin, videoQueue } from "@/server/video-queue";
import { createVideo } from "@/server/videos";

export const dynamic = "force-dynamic";

/** POST /api/series/:id/videos — charges 1 credit and queues a new video → 201 video (402 without credits). */
export const POST = (_req: Request, { params }: { params: { id: string } }) =>
  withUser(async (userId) => {
    const video = await createVideo(db(), userId, params.id);
    // After the commit. If Redis is unreachable the video is still saved as queued, and the
    // worker's recovery sweep adds it to the queue once Redis is back.
    await enqueueVideoWithin(videoQueue(), video.id).catch((e) => console.error(`[video-queue] could not queue ${video.id}:`, e instanceof Error ? e.message : e));
    return json(video, 201);
  });
