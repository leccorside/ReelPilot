import { NextRequest } from "next/server";
import { handlers } from "@/auth";

// Inside Docker the server listens on 0.0.0.0:3000, so request.url says "http://0.0.0.0:3000"
// and Auth.js builds its URLs (sign-in, callbacks, the Google redirect) from request.url.
// Rebuild the URL from the public host the request came to (X-Forwarded-Host, which Next.js
// fills from the Host header, or the proxy's value).
// Production sets AUTH_URL (docker-compose.prod.yml): Auth.js then uses that fixed address and
// ignores these headers, so a forged Host header can't change the URLs it generates.
function withPublicUrl(req: NextRequest): NextRequest {
  if (process.env.AUTH_URL) return req;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return req;
  const url = new URL(req.url);
  url.host = host;
  const proto = req.headers.get("x-forwarded-proto");
  if (proto === "http" || proto === "https") url.protocol = `${proto}:`;
  return new NextRequest(url, req);
}

export const GET = (req: NextRequest) => handlers.GET(withPublicUrl(req));
export const POST = (req: NextRequest) => handlers.POST(withPublicUrl(req));
