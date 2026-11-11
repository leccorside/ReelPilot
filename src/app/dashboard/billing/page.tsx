"use client";

import { useState } from "react";
import { Check, Loader2, Zap } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Badge, Card, CardHeader, Modal } from "@/components/dashboard/ui";
import { buttonClass } from "@/components/button";
import { useMe } from "@/lib/api-client";
import { PAID_PLANS, type PlanInfo } from "@/lib/plans";

// Plan names, prices and limits are placeholders until billing with Stripe (Passo 15).

export default function BillingPage() {
  const { data: me, isLoading } = useMe();
  const [chosen, setChosen] = useState<PlanInfo | null>(null);

  if (isLoading || !me)
    return (
      <DashboardShell crumbs={[{ label: "Dashboard", href: "/dashboard/series/" }, { label: "Billing" }]}>
        <Card className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Card>
      </DashboardShell>
    );

  const current = PAID_PLANS.find((p) => p.id === me.plan.id);
  const { balance, allowance } = me.credits;

  return (
    <DashboardShell crumbs={[{ label: "Dashboard", href: "/dashboard/series/" }, { label: "Billing" }]}>
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader title="Current plan" description={current ? `$${current.price} per month, renews monthly` : "Free trial credits"}>
            <Badge>{me.plan.name}</Badge>
          </CardHeader>
          <div className="px-6 pb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{current ? "Credits left this month" : "Credits left"}</span>
              <span className="font-medium tabular-nums" data-testid="billing-credits">
                {balance}/{allowance}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${allowance ? Math.min(100, (balance / allowance) * 100) : 0}%` }} />
            </div>
            <p className="pt-1 text-xs text-muted-foreground">One credit creates one video. A video that fails, or that you delete before it starts, gives its credit back.</p>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          {PAID_PLANS.map((p) => {
            const isCurrent = p.id === me.plan.id;
            const popular = p.id === "growth";
            return (
              <Card key={p.id} className={`relative flex flex-col p-6 ${popular ? "border-primary border-2" : ""}`}>
                {popular && <Badge className="absolute -top-3 left-6 bg-primary text-white border-primary">Most popular</Badge>}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-2">
                  <span className="font-heading text-4xl font-bold">${p.price}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" /> {perk}
                    </li>
                  ))}
                </ul>
                <button className={buttonClass(popular ? "primary" : "outline", "default", "mt-6 w-full")} disabled={isCurrent} onClick={() => setChosen(p)}>
                  {isCurrent ? (
                    "Current plan"
                  ) : (
                    <>
                      <Zap className="h-4 w-4" /> {current && current.price > p.price ? "Switch" : "Upgrade"}
                    </>
                  )}
                </button>
              </Card>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!chosen}
        onClose={() => setChosen(null)}
        title={`${chosen?.name ?? ""} plan`}
        description={chosen ? `$${chosen.price}/month · ${chosen.credits} videos per month.` : undefined}
        footer={
          <button className={buttonClass("primary")} onClick={() => setChosen(null)}>
            Got it
          </button>
        }
      >
        <p className="text-sm text-muted-foreground">
          Paid plans aren&apos;t open yet, so nothing is charged. You can keep creating videos with your free credits.
        </p>
      </Modal>
    </DashboardShell>
  );
}
