import { NextResponse } from "next/server";
import { bumpSessionVersion } from "@/server/accounts";
import { db } from "@/server/db";
import { currentUserId, unauthorized } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/account/sign-out-everywhere — invalidates every session of the user.
 * Other devices lose access on their next server check (within a minute); the caller signs out right away.
 */
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await bumpSessionVersion(db(), userId);
  return new NextResponse(null, { status: 204 });
}
