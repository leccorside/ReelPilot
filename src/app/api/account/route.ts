import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { json, readJson, withUser } from "@/server/http";
import { updateAccount } from "@/server/me";

export const dynamic = "force-dynamic";

/** PATCH /api/account — any of { name, timezone, emailNotifications, autoPublish } → the updated /api/me. */
export const PATCH = (req: Request) => withUser(async (userId) => json(await updateAccount(db(), userId, await readJson(req))));

/** DELETE /api/account — removes the account and everything in it (database cascade). */
export const DELETE = () =>
  withUser(async (userId) => {
    await db().delete(users).where(eq(users.id, userId));
    // Files in storage are removed with the account from Passo 4 on.
    return new NextResponse(null, { status: 204 });
  });
