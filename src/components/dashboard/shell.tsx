"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, ChevronsUpDown, CreditCard, Film, Info, Layers, LogOut, Menu, Settings, X, Zap } from "lucide-react";
import { Logo } from "../logo";
import { type Db, signOut, useDb } from "@/lib/store";

const NAV = [
  { href: "/dashboard/series/", label: "Series", icon: Layers },
  { href: "/dashboard/videos/", label: "Videos", icon: Film },
  { href: "/dashboard/settings/", label: "Settings", icon: Settings },
  { href: "/dashboard/billing/", label: "Billing", icon: CreditCard },
];

function UserMenu({ db }: { db: Db }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const name = db.user?.name || db.user?.email || "";
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="flex-1 truncate text-left text-muted-foreground">{name}</span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-md border bg-popover p-1 shadow-md text-sm z-50">
          <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{db.user?.email}</div>
          <Link href="/dashboard/settings/" className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent" onClick={() => setOpen(false)}>
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <Link href="/dashboard/billing/" className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent" onClick={() => setOpen(false)}>
            <CreditCard className="h-4 w-4" /> Billing
          </Link>
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent text-destructive"
            onClick={() => {
              signOut();
              router.push("/");
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ db, onNavigate }: { db: Db | null; onNavigate?: () => void }) {
  const path = usePathname() || "";
  const credits = db?.credits ?? 60;
  const total = db?.creditsTotal ?? 60;
  return (
    <>
      <div className="flex h-16 items-center px-6 md:px-10">
        <Link href="/dashboard/series/" onClick={onNavigate}>
          <Logo className="text-lg" />
        </Link>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href) || (href === "/dashboard/series/" && path.startsWith("/dashboard/create"));
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors ${
                active ? "bg-muted text-foreground" : "text-foreground hover:bg-accent"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 space-y-3">
        <div className="px-1 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1" title="One credit creates one video. Credits renew every month.">
              Credits left <Info className="h-3 w-3" />
            </span>
            <span className="tabular-nums">
              {credits}/{total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, (credits / total) * 100))}%` }} />
          </div>
        </div>
        <Link
          href="/dashboard/billing/"
          onClick={onNavigate}
          className="flex h-9 items-center justify-center gap-1.5 rounded-md border bg-background text-sm font-medium text-primary hover:bg-accent"
        >
          <Zap className="h-4 w-4 fill-primary" /> Upgrade
        </Link>
        <div className="border-t pt-2">{db?.user && <UserMenu db={db} />}</div>
      </div>
    </>
  );
}

export type Crumb = { label: string; href?: string };

export function DashboardShell({ crumbs, actions, children }: { crumbs: Crumb[]; actions?: React.ReactNode; children: React.ReactNode }) {
  const db = useDb();
  const router = useRouter();
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (db && !db.user) router.replace(`/login/?callbackUrl=${encodeURIComponent(path || "/dashboard/")}`);
  }, [db, router, path]);

  if (!db || !db.user) return <div className="min-h-screen bg-background" />;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-background border-r sticky top-0 h-screen">
        <Sidebar db={db} />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-background border-r">
            <button className="absolute right-3 top-5" aria-label="Close menu" onClick={() => setDrawer(false)}>
              <X className="h-5 w-5" />
            </button>
            <Sidebar db={db} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/95 backdrop-blur px-4 md:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button className="md:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5 min-w-0">
                  {i > 0 && <ChevronRight className="h-4 w-4 shrink-0" />}
                  {c.href ? (
                    <Link href={c.href} className="hover:text-foreground truncate">
                      {c.label}
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium truncate">{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>
          {actions}
        </div>
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
