import { NextResponse } from "next/server";
import { auth } from "@/auth";

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
