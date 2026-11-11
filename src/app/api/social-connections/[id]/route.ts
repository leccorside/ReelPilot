import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { withUser } from "@/server/http";
import { deleteConnection } from "@/server/me";

export const dynamic = "force-dynamic";

/** DELETE /api/social-connections/:id — disconnects a social account. */
export const DELETE = (_req: Request, { params }: { params: { id: string } }) =>
  withUser(async (userId) => {
    await deleteConnection(db(), userId, params.id);
    return new NextResponse(null, { status: 204 });
  });
