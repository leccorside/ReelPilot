import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { InsufficientCreditsError, NotFoundError, RateLimitedError, TooLargeError, ValidationError } from "@/server/errors";

/** Id of the signed-in user (session checked against the database), or null. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export function jsonError(status: number, error: string, headers?: HeadersInit) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export const unauthorized = () => jsonError(401, "Not signed in");

/** Parses a JSON body; returns undefined when it is missing or malformed. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Runs a route body for the signed-in user and turns domain errors into HTTP answers:
 * ValidationError → 400, InsufficientCreditsError → 402, NotFoundError → 404, TooLargeError → 413,
 * RateLimitedError → 429.
 */
export async function withUser(handler: (userId: string) => Promise<Response>): Promise<Response> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    return await handler(userId);
  } catch (e) {
    if (e instanceof ValidationError) return jsonError(400, e.message);
    if (e instanceof NotFoundError) return jsonError(404, e.message);
    if (e instanceof InsufficientCreditsError) return jsonError(402, e.message);
    if (e instanceof TooLargeError) return jsonError(413, e.message);
    if (e instanceof RateLimitedError) return jsonError(429, e.message);
    throw e;
  }
}
