"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Badge, Card, CardHeader, Confirm, Modal, Switch, Toast } from "@/components/dashboard/ui";
import { buttonClass } from "@/components/button";
import { InstagramIcon, TiktokIcon, YoutubeIcon } from "@/components/icons";
import { resetDb, updateDb, useDb } from "@/lib/store";
import { PLATFORMS } from "@/lib/options";

const ICONS = { tiktok: TiktokIcon, instagram: InstagramIcon, youtube: YoutubeIcon } as const;
const field =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60";
const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "America/Sao_Paulo", "Europe/London", "Europe/Prague", "Asia/Kolkata", "Asia/Tokyo"];

export default function SettingsPage() {
  const db = useDb();
  const { data: session, update } = useSession();
  const user = session?.user;
  const [name, setName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [del, setDel] = useState(false);
  const [everywhere, setEverywhere] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  if (!db || !user) return <DashboardShell crumbs={[{ label: "Settings" }]}>{null}</DashboardShell>;

  const shownName = name ?? user.name ?? "";

  const saveProfile = async () => {
    setSaving(true);
    const res = await fetch("/api/account/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: shownName }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setToast(body.error ?? "Could not save your profile");
      return;
    }
    // With an argument, update() POSTs to the session endpoint (trigger "update"), and src/auth.ts
    // re-reads the profile from the database. Without one it only re-fetches the current token.
    // The argument's content is ignored on purpose: the client never sets session fields.
    await update({});
    setName(null);
    setToast("Profile saved");
  };

  const signOutEverywhere = async () => {
    const res = await fetch("/api/account/sign-out-everywhere/", { method: "POST" });
    if (!res.ok) return setToast("Could not sign out other devices");
    await signOut({ redirectTo: "/login/" });
  };

  const deleteAccount = async () => {
    const res = await fetch("/api/account/", { method: "DELETE" });
    if (!res.ok) return setToast("Could not delete your account");
    resetDb(); // the dashboard data that still lives in this browser (until Passo 3)
    await signOut({ redirectTo: "/" });
  };
  const platform = PLATFORMS.find((p) => p.id === connecting);

  return (
    <DashboardShell crumbs={[{ label: "Dashboard", href: "/dashboard/series/" }, { label: "Settings" }]}>
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader title="Profile" description="Your account details" />
          <form
            className="space-y-4 px-6 pb-6"
            onSubmit={(e) => {
              e.preventDefault();
              void saveProfile();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>Name</span>
                <input className={field} value={shownName} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Email</span>
                <input className={field} value={user.email ?? ""} disabled />
              </label>
            </div>
            <button className={buttonClass("primary")} disabled={name === null || !shownName.trim() || saving}>
              Save changes
            </button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Connected accounts" description="Where your series post their videos" />
          <div className="divide-y px-6 pb-2">
            {PLATFORMS.map((p) => {
              const Icon = ICONS[p.id as keyof typeof ICONS];
              const value = db.connected[p.id];
              return (
                <div key={p.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{value ?? "Not connected"}</p>
                    </div>
                  </div>
                  {value ? (
                    <div className="flex items-center gap-2">
                      <Badge tone="green">Connected</Badge>
                      <button
                        className={buttonClass("outline", "sm")}
                        onClick={() => {
                          updateDb((d) => void (d.connected[p.id] = null));
                          setToast(`${p.name} disconnected`);
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      className={buttonClass("outline", "sm")}
                      onClick={() => {
                        setHandle("");
                        setConnecting(p.id);
                      }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Preferences" />
          <div className="divide-y px-6 pb-2">
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-medium">Publish automatically</p>
                <p className="text-xs text-muted-foreground">Post finished videos to your connected accounts right away</p>
              </div>
              <Switch label="Publish automatically" checked={db.settings.autoPublish} onChange={(v) => updateDb((d) => void (d.settings.autoPublish = v))} />
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-medium">Email notifications</p>
                <p className="text-xs text-muted-foreground">Get an email when a video is published</p>
              </div>
              <Switch
                label="Email notifications"
                checked={db.settings.emailNotifications}
                onChange={(v) => updateDb((d) => void (d.settings.emailNotifications = v))}
              />
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-medium">Time zone</p>
                <p className="text-xs text-muted-foreground">Used for posting times</p>
              </div>
              <select
                className={`${field} w-48`}
                value={db.settings.timezone}
                onChange={(e) => updateDb((d) => void (d.settings.timezone = e.target.value))}
              >
                {TIMEZONES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card className="border-red-200">
          <CardHeader title="Danger zone" description="Sign out or remove your account and everything in it" />
          <div className="flex flex-wrap gap-2 px-6 pb-6">
            <button className={buttonClass("outline")} onClick={() => signOut({ redirectTo: "/" })}>
              Sign out
            </button>
            <button className={buttonClass("outline")} onClick={() => setEverywhere(true)}>
              Sign out of all devices
            </button>
            <button className={buttonClass("primary", "default", "bg-destructive hover:bg-destructive/90")} onClick={() => setDel(true)}>
              Delete account
            </button>
          </div>
        </Card>
      </div>

      <Modal
        open={!!connecting}
        onClose={() => setConnecting(null)}
        title={`Connect ${platform?.name ?? ""}`}
        description="Enter the account handle to connect. In the real service this opens the platform's own sign-in."
        footer={
          <>
            <button className={buttonClass("outline")} onClick={() => setConnecting(null)}>
              Cancel
            </button>
            <button
              className={buttonClass("primary")}
              disabled={handle.trim().length < 2}
              onClick={() => {
                const h = handle.trim().startsWith("@") ? handle.trim() : `@${handle.trim()}`;
                updateDb((d) => void (d.connected[connecting!] = h));
                setToast(`${platform?.name} connected`);
                setConnecting(null);
              }}
            >
              Connect
            </button>
          </>
        }
      >
        <input className={field} placeholder="@yourchannel" value={handle} onChange={(e) => setHandle(e.target.value)} autoFocus />
      </Modal>
      <Confirm
        open={del}
        onClose={() => setDel(false)}
        danger
        title="Delete your account?"
        description="Your series, videos and connected accounts are removed. This can't be undone."
        confirmLabel="Delete account"
        onConfirm={() => void deleteAccount()}
      />
      <Confirm
        open={everywhere}
        onClose={() => setEverywhere(false)}
        title="Sign out of all devices?"
        description="Every browser where you are signed in loses access within a minute, including this one."
        confirmLabel="Sign out everywhere"
        onConfirm={() => void signOutEverywhere()}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </DashboardShell>
  );
}
