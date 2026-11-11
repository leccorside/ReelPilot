// Plans shown on the billing page. Prices and limits are placeholders until billing (Passo 15).

export type PlanId = "free" | "starter" | "growth" | "pro";

/** maxSeries: how many series the plan allows (null = unlimited). Enforced by the API. */
export type PlanInfo = { id: PlanId; name: string; price: number; credits: number; maxSeries: number | null; perks: string[] };

/** Free accounts only have the signup bonus (no monthly renewal) and one series, like Starter. */
export const FREE_PLAN: PlanInfo = { id: "free", name: "Free", price: 0, credits: 60, maxSeries: 1, perks: [] };

export const PAID_PLANS: PlanInfo[] = [
  { id: "starter", name: "Starter", price: 19, credits: 30, maxSeries: 1, perks: ["30 videos per month", "1 series", "Auto-posting to 1 platform", "All art styles"] },
  { id: "growth", name: "Growth", price: 39, credits: 90, maxSeries: 3, perks: ["90 videos per month", "3 series", "Auto-posting to all platforms", "Custom background music"] },
  { id: "pro", name: "Pro", price: 69, credits: 200, maxSeries: null, perks: ["200 videos per month", "Unlimited series", "Priority rendering", "Premium voices"] },
];

export function planInfo(id: PlanId): PlanInfo {
  return PAID_PLANS.find((p) => p.id === id) ?? FREE_PLAN;
}
