import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { json, readJson, withUser } from "@/server/http";
import { deleteSeries, getSeries, updateSeries } from "@/server/series";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** GET /api/series/:id */
export const GET = (_req: Request, { params }: Ctx) => withUser(async (userId) => json(await getSeries(db(), userId, params.id)));

/** PATCH /api/series/:id — any wizard field, or { status: "active" | "paused" }. */
export const PATCH = (req: Request, { params }: Ctx) =>
  withUser(async (userId) => json(await updateSeries(db(), userId, params.id, await readJson(req))));

/** DELETE /api/series/:id — removes the series and its videos (queued ones are refunded). */
export const DELETE = (_req: Request, { params }: Ctx) =>
  withUser(async (userId) => {
    await deleteSeries(db(), userId, params.id);
    return new NextResponse(null, { status: 204 });
  });
