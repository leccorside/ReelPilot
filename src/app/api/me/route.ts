import { db } from "@/server/db";
import { json, withUser } from "@/server/http";
import { getMe } from "@/server/me";

export const dynamic = "force-dynamic";

/** GET /api/me — profile, preferences, plan, credit balance and connected social accounts. */
export const GET = () => withUser(async (userId) => json(await getMe(db(), userId)));
