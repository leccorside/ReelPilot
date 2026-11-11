import { eq, sql } from "drizzle-orm";
import type { Db } from "./index";
import { creditLedger } from "./schema";

/** Signup bonus for new accounts (same amount the prototype gave). */
export const SIGNUP_BONUS_CREDITS = 60;

/** Current balance = sum of every ledger entry of the user. */
export async function getCreditBalance(db: Pick<Db, "select">, userId: string): Promise<number> {
  const [row] = await db
    .select({ balance: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));
  return row?.balance ?? 0;
}
