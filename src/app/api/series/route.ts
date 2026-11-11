import { db } from "@/server/db";
import { json, readJson, withUser } from "@/server/http";
import { getMe } from "@/server/me";
import { createSeries, listSeries } from "@/server/series";

export const dynamic = "force-dynamic";

/** GET /api/series — the user's series, newest first, with video counts. */
export const GET = () => withUser(async (userId) => json(await listSeries(db(), userId)));

/** POST /api/series — creates a series from the wizard fields → 201 series. */
export const POST = (req: Request) =>
  withUser(async (userId) => {
    const me = await getMe(db(), userId);
    return json(await createSeries(db(), userId, await readJson(req), me.user.timezone), 201);
  });
