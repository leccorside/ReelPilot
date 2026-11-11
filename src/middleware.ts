import NextAuth from "next-auth";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Runs on the Edge runtime, for every page and API route except the public ones (see `config`).
// 1. Adds the trailing slash to page URLs (next.config.mjs has skipTrailingSlashRedirect).
// 2. Protects /dashboard and the private API: only checks that a valid (signed, unexpired) session
//    cookie exists. The database check (deleted account, "sign out everywhere") is in src/auth.ts.

const { auth } = NextAuth(authConfig);

/** Public origin of the request (the server itself listens on 0.0.0.0:3000 inside Docker). */
function publicOrigin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

const isProtected = (pathname: string) => pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname.startsWith("/api/");

const protect = auth((req) => {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    if (req.auth) return NextResponse.next();
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!req.auth) {
    const url = new URL("/login/", publicOrigin(req));
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname, search } = req.nextUrl;

  // Pages always end with "/" (same URLs as before); files such as /favicon.ico are left alone.
  if (!pathname.startsWith("/api/") && !pathname.endsWith("/") && !/\.[a-z0-9]+$/i.test(pathname)) {
    return NextResponse.redirect(new URL(`${pathname}/${search}`, publicOrigin(req)), 308);
  }

  if (isProtected(pathname)) return protect(req, event as never);
  return NextResponse.next();
}

// Public API routes stay out of the middleware entirely. For /api/auth this also matters for
// correctness: the middleware re-issues the session cookie, and that copy would overwrite the
// cookie Auth.js clears on sign-out or replaces on session update.
export const config = {
  matcher: ["/((?!_next/|api/auth(?:/|$)|api/health(?:/|$)|api/register(?:/|$)).*)"],
};
