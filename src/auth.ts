import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, isNull } from "drizzle-orm";
import NextAuth, { CredentialsSignin } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "@/auth.config";
import { env } from "@/lib/env";
import { clientIp, getSessionVersion, grantSignupBonus, verifyCredentials } from "@/server/accounts";
import { hardenAdapter } from "@/server/auth-adapter";
import { db } from "@/server/db";
import { accounts, sessions, users, verificationTokens } from "@/server/db/schema";
import { redis } from "@/server/redis";

/** Error codes the login page understands (returned as `code` by signIn on the client). */
class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}
class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}

/** How often a session is checked against the database (deleted account, "sign out everywhere"). */
const REVALIDATE_MS = 60_000;

// Lazy config: the database and the environment are read on the first request, never at build time.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const e = env();
  const database = db();

  const base = DrizzleAdapter(database, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  });
  // Lowercase e-mails and no provider tokens in the database (see hardenAdapter).
  const adapter = hardenAdapter(base);

  const providers: Provider[] = [];
  if (e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: e.AUTH_GOOGLE_ID,
        clientSecret: e.AUTH_GOOGLE_SECRET,
        // Google verifies e-mail ownership, so an existing e-mail/password account with the
        // same address is linked instead of failing with OAuthAccountNotLinked.
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }
  providers.push(
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const result = await verifyCredentials(database, redis(), credentials, {
          ip: clientIp(request.headers),
          rateLimitScale: e.AUTH_RATE_LIMIT_SCALE,
        });
        if (!result.ok) throw result.reason === "rate_limited" ? new RateLimited() : new InvalidCredentials();
        return result.user;
      },
    }),
  );

  return {
    ...authConfig,
    secret: e.AUTH_SECRET,
    adapter,
    providers,
    callbacks: {
      ...authConfig.callbacks,
      async jwt({ token, user, trigger }) {
        if (user?.id) {
          // Just signed in.
          const version = (user as { sessionVersion?: number }).sessionVersion ?? (await getSessionVersion(database, user.id));
          token.sub = user.id;
          token.sv = version ?? 0;
          token.checkedAt = Date.now();
          return token;
        }
        if (!token.sub) return null;

        if (trigger === "update" || Date.now() - (token.checkedAt ?? 0) > REVALIDATE_MS) {
          const [row] = await database
            .select({ v: users.sessionVersion, name: users.name, email: users.email, image: users.image })
            .from(users)
            .where(eq(users.id, token.sub))
            .limit(1);
          // Account deleted or "sign out everywhere": this token is no longer valid.
          if (!row || row.v !== (token.sv ?? 0)) return null;
          token.name = row.name;
          token.email = row.email;
          token.picture = row.image;
          token.checkedAt = Date.now();
        }
        return token;
      },
    },
    events: {
      // Accounts created through Google get the same signup bonus as e-mail sign-ups.
      async createUser({ user }) {
        if (user.id) await grantSignupBonus(database, user.id);
      },
      // Records that Google verified the address (the adapter leaves email_verified empty).
      async signIn({ user, account, profile }) {
        if (account?.provider === "google" && profile?.email_verified === true && user.id) {
          await database
            .update(users)
            .set({ emailVerified: new Date() })
            .where(and(eq(users.id, user.id), isNull(users.emailVerified)));
        }
      },
    },
  };
});
