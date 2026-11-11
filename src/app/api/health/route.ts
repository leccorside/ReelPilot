import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { healthReport } from "@/server/health";

export const dynamic = "force-dynamic";

/** GET /api/health — 200 when database, Redis and storage answer; 503 otherwise. Used by Docker healthchecks. */
export async function GET() {
  const report = await healthReport(env());
  // Error details stay in the server log; the public answer only says which check failed.
  if (!report.ok) console.error("[health]", JSON.stringify(report.checks));
  const body = {
    status: report.ok ? "ok" : "degraded",
    checks: Object.fromEntries(Object.entries(report.checks).map(([k, v]) => [k, { ok: v.ok, ms: v.ms }])),
  };
  return NextResponse.json(body, { status: report.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
