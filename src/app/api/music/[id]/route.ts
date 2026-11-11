import { NextResponse } from "next/server";
import { withUser } from "@/server/http";
import { deleteMusic } from "@/server/music";
import { musicDeps } from "@/server/music-deps";

export const dynamic = "force-dynamic";

/** DELETE /api/music/:id — removes the track from the library, from every series and from storage. */
export const DELETE = (_req: Request, { params }: { params: { id: string } }) =>
  withUser(async (userId) => {
    await deleteMusic(musicDeps(), userId, params.id);
    return new NextResponse(null, { status: 204 });
  });
