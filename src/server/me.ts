import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { MeDto } from "@/lib/api-types";
import { ACCOUNT_NAME_MAX } from "@/lib/limits";
import { FREE_PLAN, planInfo } from "@/lib/plans";
import type { Db } from "@/server/db";
import { getCreditBalance } from "@/server/db/credits";
import { series, socialConnections, users } from "@/server/db/schema";
import { NotFoundError, ValidationError } from "@/server/errors";
import { currentPlan } from "@/server/plan";
import { isValidTimezone } from "@/server/series";

export { currentPlan };

export async function getMe(db: Db, userId: string): Promise<MeDto> {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      timezone: users.timezone,
      emailNotifications: users.emailNotifications,
      autoPublish: users.autoPublish,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new NotFoundError("Account not found");

  const [planId, balance, connections, [{ seriesUsed }]] = await Promise.all([
    currentPlan(db, userId),
    getCreditBalance(db, userId),
    db
      .select({ id: socialConnections.id, platform: socialConnections.platform, username: socialConnections.username, status: socialConnections.status })
      .from(socialConnections)
      .where(eq(socialConnections.userId, userId)),
    db.select({ seriesUsed: sql<number>`count(*)::int` }).from(series).where(eq(series.userId, userId)),
  ]);
  const plan = planInfo(planId);
  return {
    user,
    plan: { id: plan.id, name: plan.name, monthlyCredits: plan.credits },
    limits: { series: plan.maxSeries, seriesUsed },
    // "allowance" is the size of the credit bar: the monthly credits of the plan (or the signup
    // bonus on Free), never less than the current balance.
    credits: { balance, allowance: Math.max(plan.id === "free" ? FREE_PLAN.credits : plan.credits, balance) },
    connections,
  };
}

export const accountSchema = z
  .object({
    name: z.string().trim().min(1, "Name can't be empty.").max(ACCOUNT_NAME_MAX, `Your name can have at most ${ACCOUNT_NAME_MAX} characters.`),
    timezone: z.string().refine(isValidTimezone, "Unknown time zone."),
    emailNotifications: z.boolean(),
    autoPublish: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.");

/** Updates the profile and preferences (any subset of the fields). */
export async function updateAccount(db: Db, userId: string, input: unknown): Promise<MeDto> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid data.");
  await db.update(users).set(parsed.data).where(eq(users.id, userId));
  return getMe(db, userId);
}

/** Disconnects a social account of the user. */
export async function deleteConnection(db: Db, userId: string, id: string): Promise<void> {
  if (!z.string().uuid().safeParse(id).success) throw new NotFoundError("Connection not found");
  const deleted = await db
    .delete(socialConnections)
    .where(and(eq(socialConnections.id, id), eq(socialConnections.userId, userId)))
    .returning({ id: socialConnections.id });
  if (deleted.length === 0) throw new NotFoundError("Connection not found");
}
