import { env } from "@/lib/env";
import { jsonError } from "@/server/http";
import { verifyMediaSignature } from "@/server/media-url";
import { getObject, storage } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/media/<key>?exp=…&sig=… — streams a stored file from a signed, short-lived link
 * (src/server/media-url.ts). Works without a session (<audio>/<video> tags can't send one);
 * the signature is the permission. Supports Range requests so players can seek.
 */
export async function GET(req: Request, { params }: { params: { key: string[] } }) {
  const key = params.key.join("/"); // Next.js already decodes each segment
  if (!key.startsWith("users/") || key.split("/").some((p) => p === "" || p === "." || p === "..")) return jsonError(404, "Not found");

  const url = new URL(req.url);
  const check = verifyMediaSignature(env().AUTH_SECRET, key, url.searchParams.get("exp"), url.searchParams.get("sig"));
  if (!check.ok) return jsonError(check.reason === "expired" ? 410 : 403, check.reason === "expired" ? "This link has expired" : "Invalid link");

  const range = req.headers.get("range");
  const obj = await getObject(storage(), key, range && /^bytes=\d*-\d*$/.test(range) ? range : undefined);
  if (!obj?.Body) return jsonError(404, "Not found");

  const headers = new Headers({
    "Content-Type": obj.ContentType ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  });
  if (obj.ContentLength !== undefined) headers.set("Content-Length", String(obj.ContentLength));
  if (obj.ContentRange) headers.set("Content-Range", obj.ContentRange);
  return new Response(obj.Body.transformToWebStream(), { status: obj.ContentRange ? 206 : 200, headers });
}
