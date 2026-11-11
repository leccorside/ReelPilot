import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { currentUserId, jsonError, readJson, unauthorized } from "@/server/http";

export const dynamic = "force-dynamic";

const profileSchema = z.object({ name: z.string().trim().min(1, "Name can't be empty.").max(80) });

/** PATCH /api/account — { name } updates the profile. */
export async function PATCH(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const parsed = profileSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid data.");

  const [user] = await db()
    .update(users)
    .set({ name: parsed.data.name })
    .where(eq(users.id, userId))
    .returning({ id: users.id, name: users.name, email: users.email });
  return NextResponse.json({ user });
}

/** DELETE /api/account — removes the account and everything in it (database cascade). */
export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await db().delete(users).where(eq(users.id, userId));
  // Files in storage are removed with the account from Passo 4 on.
  return new NextResponse(null, { status: 204 });
}
