import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { json, readJson, withUser } from "@/server/http";
import { updateAccount } from "@/server/me";
import { cleanupAfterCommit, deletePrefix, keys, storage } from "@/server/storage";

export const dynamic = "force-dynamic";

/** PATCH /api/account — any of { name, timezone, emailNotifications, autoPublish } → the updated /api/me. */
export const PATCH = (req: Request) => withUser(async (userId) => json(await updateAccount(db(), userId, await readJson(req))));

/** DELETE /api/account — removes the account, everything in the database (cascade) and all its files. */
export const DELETE = () =>
  withUser(async (userId) => {
    await db().delete(users).where(eq(users.id, userId));
    await cleanupAfterCommit(() => deletePrefix(storage(), keys.user(userId)), `account ${userId}`);
    return new NextResponse(null, { status: 204 });
  });
