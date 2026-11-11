import { and, desc, eq, inArray } from "drizzle-orm";
import type { PlanId } from "@/lib/plans";
import type { DbOrTx } from "@/server/db";
import { subscriptions } from "@/server/db/schema";

/** Plan that currently applies: the subscription that still counts, or Free. */
export async function currentPlan(db: DbOrTx, userId: string): Promise<PlanId> {
  const [sub] = await db
    .select({ plan: subscriptions.plan })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.status, ["active", "trialing", "past_due"])))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return sub?.plan ?? "free";
}
