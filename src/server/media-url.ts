import { createHmac, timingSafeEqual } from "node:crypto";

// Short-lived signed links to stored files, served by /api/media/<key>?exp=…&sig=….
// The link itself is the permission (an <audio> tag can't send our session), so it only works
// for the key it was made for and until it expires. The signing key is derived from AUTH_SECRET.

export const MEDIA_URL_TTL_SEC = 30 * 60;

function hmac(secret: string, key: string, exp: number): string {
  const signingKey = createHmac("sha256", secret).update("reelpilot:media-url:v1").digest();
  return createHmac("sha256", signingKey).update(`${key}\n${exp}`).digest("base64url");
}

/** Path (relative URL) that serves `key` for `ttlSec` seconds. */
export function signMediaPath(secret: string, key: string, ttlSec = MEDIA_URL_TTL_SEC, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSec;
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `/api/media/${encodedKey}?exp=${exp}&sig=${hmac(secret, key, exp)}`;
}

export type MediaCheck = { ok: true } | { ok: false; reason: "expired" | "invalid" };

export function verifyMediaSignature(secret: string, key: string, exp: string | null, sig: string | null, now = Date.now()): MediaCheck {
  const expNum = Number(exp);
  if (!exp || !sig || !Number.isInteger(expNum)) return { ok: false, reason: "invalid" };
  const expected = Buffer.from(hmac(secret, key, expNum));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "invalid" };
  if (expNum * 1000 < now) return { ok: false, reason: "expired" };
  return { ok: true };
}
