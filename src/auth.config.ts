import type { NextAuthConfig } from "next-auth";

// Edge-safe part of the Auth.js config: no database, no Node APIs.
// Used by the middleware to read the session cookie; src/auth.ts extends it for the Node server.

/** Sessions are JWTs that expire after 2 hours without activity (the dashboard refreshes them while open). */
export const SESSION_MAX_AGE_SEC = 2 * 60 * 60;

export const authConfig = {
  pages: { signIn: "/login/", error: "/login/" },
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SEC },
  trustHost: true,
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
