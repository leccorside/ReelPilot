"use client";

import { useState } from "react";
import { Check, Loader2, Zap } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Badge, Card, CardHeader, Confirm, Modal, Toast } from "@/components/dashboard/ui";
import { buttonClass } from "@/components/button";
import { PLANS, type Plan, updateDb, useDb } from "@/lib/store";

// Plan names, prices and limits are placeholders: the original's billing page is behind a login.

export default function BillingPage() {
  const db = useDb();
  const [checkout, setCheckout] = useState<Plan | null>(null);
  const [paying, setPaying] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  if (!db) return <DashboardShell crumbs={[{ label: "Billing" }]}>{null}</DashboardShell>;

  const current = PLANS.find((p) => p.id === db.plan);
  const chosen = PLANS.find((p) => p.id === checkout);

  return (
    <DashboardShell crumbs={[{ label: "Dashboard", href: "/dashboard/series/" }, { label: "Billing" }]}>
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader title="Current plan" description={current ? `$${current.price} per month, renews monthly` : "Free trial credits"}>
            <Badge>{current?.name ?? "Free"}</Badge>
          </CardHeader>
          <div className="px-6 pb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Credits left this month</span>
              <span className="font-medium tabular-nums">
                {db.credits}/{db.creditsTotal}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(db.credits / db.creditsTotal) * 100}%` }} />
            </div>
            {current && (
              <button className={buttonClass("ghost", "sm", "mt-2 -ml-3 text-muted-foreground")} onClick={() => setCancel(true)}>
                Cancel subscription
              </button>
            )}
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent = p.id === db.plan;
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
                <button
                  className={buttonClass(popular ? "primary" : "outline", "default", "mt-6 w-full")}
                  disabled={isCurrent}
                  onClick={() => setCheckout(p.id)}
                >
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
        open={!!checkout}
        onClose={() => !paying && setCheckout(null)}
        title={`Upgrade to ${chosen?.name ?? ""}`}
        description={chosen ? `$${chosen.price}/month · ${chosen.credits} videos per month. This rebuild doesn't charge anything.` : undefined}
        footer={
          <>
            <button className={buttonClass("outline")} disabled={paying} onClick={() => setCheckout(null)}>
              Cancel
            </button>
            <button
              className={buttonClass("primary")}
              disabled={paying}
              onClick={() => {
                setPaying(true);
                window.setTimeout(() => {
                  updateDb((d) => {
                    d.plan = chosen!.id;
                    d.credits = chosen!.credits;
                    d.creditsTotal = chosen!.credits;
                  });
                  setPaying(false);
                  setCheckout(null);
                  setToast(`You're on the ${chosen!.name} plan`);
                }, 900);
              }}
            >
              {paying && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm and pay
            </button>
          </>
        }
      />
      <Confirm
        open={cancel}
        onClose={() => setCancel(false)}
        danger
        title="Cancel your subscription?"
        description="Your series stop creating new videos and you go back to the free credits."
        confirmLabel="Cancel subscription"
        onConfirm={() => {
          updateDb((d) => {
            d.plan = "free";
            d.creditsTotal = 60;
            d.credits = Math.min(d.credits, 60);
          });
          setToast("Subscription cancelled");
        }}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </DashboardShell>
  );
}
