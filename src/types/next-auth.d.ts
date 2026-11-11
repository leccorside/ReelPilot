import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

// next-auth/jwt re-exports this interface from @auth/core.
declare module "@auth/core/jwt" {
  interface JWT {
    /** users.session_version when the token was issued. */
    sv?: number;
    /** Last time (ms) the token was checked against the database. */
    checkedAt?: number;
  }
}
