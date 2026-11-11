import { eq, sql } from "drizzle-orm";
import type Redis from "ioredis";
import { z } from "zod";
import type { Db } from "@/server/db";
import { SIGNUP_BONUS_CREDITS } from "@/server/db/credits";
import { creditLedger, users } from "@/server/db/schema";
import { burnPasswordCheck, hashPassword, PASSWORD_MAX, PASSWORD_MIN, verifyPassword } from "@/server/password";
import { hit, type Limit, peek, reset, scaled } from "@/server/rate-limit";

// Account rules shared by the sign-up route, the Credentials provider and the Google sign-in.

export const LIMITS = {
  /** Wrong passwords for one e-mail address. */
  loginFailuresPerEmail: { max: 5, windowSec: 15 * 60 },
  /** Sign-in attempts (right or wrong) from one IP address. */
  loginAttemptsPerIp: { max: 30, windowSec: 15 * 60 },
  /** New accounts from one IP address. */
  signupsPerIp: { max: 5, windowSec: 60 * 60 },
} satisfies Record<string, Limit>;

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(PASSWORD_MAX),
});

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: z
    .string()
    .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters.`)
    .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters.`),
  name: z.string().trim().max(80).optional(),
});

export type PublicUser = { id: string; name: string | null; email: string; image: string | null };

export type SignupResult =
  | { ok: true; user: PublicUser }
  | { ok: false; status: 400 | 409 | 429; error: string; retryAfterSec?: number };

/** Creates an e-mail/password account and grants the signup bonus, in one transaction. */
export async function registerUser(
  db: Db,
  r: Redis,
  input: unknown,
  ctx: { ip: string; rateLimitScale?: number },
): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Invalid data." };

  const limit = await hit(r, `rl:signup:ip:${ctx.ip}`, scaled(LIMITS.signupsPerIp, ctx.rateLimitScale ?? 1));
  if (limit.blocked) {
    return { ok: false, status: 429, error: "Too many accounts created. Try again later.", retryAfterSec: limit.retryAfterSec };
  }

  const { email, password, name } = parsed.data;
  const passwordHash = await hashPassword(password);
  try {
    const user = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({ email, passwordHash, name: name || email.split("@")[0] })
        .returning({ id: users.id, name: users.name, email: users.email, image: users.image });
      await grantSignupBonus(tx, created.id);
      return created;
    });
    return { ok: true, user };
  } catch (e) {
    const code = (e as { cause?: { code?: string }; code?: string }).cause?.code ?? (e as { code?: string }).code;
    if (code === "23505") return { ok: false, status: 409, error: "An account with this email already exists." };
    throw e;
  }
}

export type CredentialsResult =
  | { ok: true; user: PublicUser & { sessionVersion: number } }
  | { ok: false; reason: "invalid" | "rate_limited"; retryAfterSec?: number };

/** Checks an e-mail/password pair with per-IP and per-e-mail limits. */
export async function verifyCredentials(
  db: Db,
  r: Redis,
  input: unknown,
  ctx: { ip: string; rateLimitScale?: number },
): Promise<CredentialsResult> {
  const scale = ctx.rateLimitScale ?? 1;
  const parsed = credentialsSchema.safeParse(input);

  const ipState = await hit(r, `rl:login:ip:${ctx.ip}`, scaled(LIMITS.loginAttemptsPerIp, scale));
  if (ipState.blocked) return { ok: false, reason: "rate_limited", retryAfterSec: ipState.retryAfterSec };
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const { email, password } = parsed.data;
  const emailKey = `rl:login:email:${email}`;
  const emailLimit = scaled(LIMITS.loginFailuresPerEmail, scale);
  const emailState = await peek(r, emailKey, emailLimit);
  if (emailState.blocked) return { ok: false, reason: "rate_limited", retryAfterSec: emailState.retryAfterSec };

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = user?.passwordHash ? await verifyPassword(user.passwordHash, password) : (await burnPasswordCheck(password), false);

  if (!user || !valid) {
    const after = await hit(r, emailKey, emailLimit);
    return after.blocked ? { ok: false, reason: "rate_limited", retryAfterSec: after.retryAfterSec } : { ok: false, reason: "invalid" };
  }

  await reset(r, emailKey);
  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, image: user.image, sessionVersion: user.sessionVersion },
  };
}

/** Current session version of a user, or null when the account no longer exists. */
export async function getSessionVersion(db: Db, userId: string): Promise<number | null> {
  const [row] = await db.select({ v: users.sessionVersion }).from(users).where(eq(users.id, userId)).limit(1);
  return row ? row.v : null;
}

/** Invalidates every session of the user (all devices) on their next check. */
export async function bumpSessionVersion(db: Db, userId: string): Promise<void> {
  await db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
}

/** Grants the signup bonus once (used for accounts created through Google). */
export async function grantSignupBonus(db: Pick<Db, "insert">, userId: string): Promise<void> {
  await db
    .insert(creditLedger)
    .values({ userId, delta: SIGNUP_BONUS_CREDITS, reason: "signup_bonus", idempotencyKey: `signup:${userId}` })
    .onConflictDoNothing({ target: creditLedger.idempotencyKey });
}

/** Client IP from the proxy headers. The last X-Forwarded-For entry is the one our own proxy added. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const last = forwarded?.split(",").map((s) => s.trim()).filter(Boolean).pop();
  return last || headers.get("x-real-ip") || "unknown";
}
