import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { clientIp, registerUser } from "@/server/accounts";
import { db } from "@/server/db";
import { jsonError, readJson } from "@/server/http";
import { redis } from "@/server/redis";

export const dynamic = "force-dynamic";

/** POST /api/register — { email, password, name? } → 201 { user }. The client then signs in. */
export async function POST(req: Request) {
  const result = await registerUser(db(), redis(), await readJson(req), {
    ip: clientIp(req.headers),
    rateLimitScale: env().AUTH_RATE_LIMIT_SCALE,
  });
  if (!result.ok) {
    const headers = result.retryAfterSec ? { "Retry-After": String(result.retryAfterSec) } : undefined;
    return jsonError(result.status, result.error, headers);
  }
  return NextResponse.json({ user: { id: result.user.id, email: result.user.email, name: result.user.name } }, { status: 201 });
}
