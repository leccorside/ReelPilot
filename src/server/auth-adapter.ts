import type { Adapter } from "next-auth/adapters";

/**
 * Wraps the Auth.js database adapter with the project's rules:
 * - e-mails are stored lowercase (database check constraint);
 * - OAuth tokens from the sign-in providers are dropped before they reach the database. Sign-in
 *   only needs the provider account id; publishing to YouTube/TikTok/Instagram uses its own
 *   encrypted connection (social_connections), so storing these plain-text tokens would only add risk.
 */
export function hardenAdapter(base: Adapter): Adapter {
  return {
    ...base,
    createUser: (user) => base.createUser!({ ...user, email: user.email.toLowerCase() }),
    getUserByEmail: (email) => base.getUserByEmail!(email.toLowerCase()),
    linkAccount: (account) =>
      base.linkAccount!({
        ...account,
        access_token: undefined,
        refresh_token: undefined,
        id_token: undefined,
        expires_at: undefined,
        session_state: undefined,
      }),
  };
}
