"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Badge, Card, CardHeader, Confirm, Modal, Switch, Toast } from "@/components/dashboard/ui";
import { buttonClass } from "@/components/button";
import { InstagramIcon, TiktokIcon, YoutubeIcon } from "@/components/icons";
import { api, ApiError, useMe } from "@/lib/api-client";
import type { MeDto } from "@/lib/api-types";
import { PLATFORMS } from "@/lib/options";

const ICONS = { tiktok: TiktokIcon, instagram: InstagramIcon, youtube: YoutubeIcon } as const;
const field =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60";
const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "America/Sao_Paulo", "Europe/London", "Europe/Prague", "Asia/Kolkata", "Asia/Tokyo"];

type Prefs = Partial<Pick<MeDto["user"], "name" | "timezone" | "emailNotifications" | "autoPublish">>;

export default function SettingsPage() {
  const { data: me, mutate } = useMe();
  const { update } = useSession();
  const [name, setName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnect, setDisconnect] = useState<MeDto["connections"][number] | null>(null);
  const [del, setDel] = useState(false);
  const [everywhere, setEverywhere] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (!me)
    return (
      <DashboardShell crumbs={[{ label: "Dashboard", href: "/dashboard/series/" }, { label: "Settings" }]}>
        <Card className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Card>
      </DashboardShell>
    );

  const user = me.user;
  const shownName = name ?? user.name ?? "";
  const timezones = TIMEZONES.includes(user.timezone) ? TIMEZONES : [user.timezone, ...TIMEZONES];

  /** Saves profile/preference fields; switches update on screen right away and roll back on error. */
  const save = async (prefs: Prefs, done?: string) => {
    const previous = me;
    await mutate({ ...me, user: { ...me.user, ...prefs } }, { revalidate: false });
    try {
      await mutate(await api<MeDto>("/api/account/", { method: "PATCH", body: prefs }), { revalidate: false });
      if (done) setToast(done);
      return true;
    } catch (e) {
      await mutate(previous, { revalidate: false });
      setToast(e instanceof ApiError ? e.message : "Could not save your settings");
      return false;
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    if (await save({ name: shownName.trim() }, "Profile saved")) {
      // With an argument, update() POSTs to the session endpoint (trigger "update"), and src/auth.ts
      // re-reads the profile from the database. The argument's content is ignored on purpose.
      await update({});
      setName(null);
    }
    setSaving(false);
  };

  const removeConnection = async (c: MeDto["connections"][number]) => {
    try {
      await api(`/api/social-connections/${c.id}/`, { method: "DELETE" });
      await mutate();
      setToast(`${PLATFORMS.find((p) => p.id === c.platform)?.name ?? "Account"} disconnected`);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Could not disconnect the account");
    }
  };

  const signOutEverywhere = async () => {
    try {
      await api("/api/account/sign-out-everywhere/", { method: "POST" });
      await signOut({ redirectTo: "/login/" });
    } catch {
      setToast("Could not sign out other devices");
    }
  };

  const deleteAccount = async () => {
    try {
      await api("/api/account/", { method: "DELETE" });
      await signOut({ redirectTo: "/" });
    } catch {
      setToast("Could not delete your account");
    }
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
                <input className={field} value={user.email} disabled />
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
              const conn = me.connections.find((c) => c.platform === p.id);
              return (
                <div key={p.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{conn?.username ?? "Not connected"}</p>
                    </div>
                  </div>
                  {conn ? (
                    <div className="flex items-center gap-2">
                      <Badge tone={conn.status === "active" ? "green" : "amber"}>{conn.status === "active" ? "Connected" : "Reconnect needed"}</Badge>
                      <button className={buttonClass("outline", "sm")} onClick={() => setDisconnect(conn)}>
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button className={buttonClass("outline", "sm")} onClick={() => setConnecting(p.id)}>
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
              <Switch label="Publish automatically" checked={user.autoPublish} onChange={(v) => void save({ autoPublish: v })} />
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-medium">Email notifications</p>
                <p className="text-xs text-muted-foreground">Get an email when a video is published</p>
              </div>
              <Switch label="Email notifications" checked={user.emailNotifications} onChange={(v) => void save({ emailNotifications: v })} />
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-medium">Time zone</p>
                <p className="text-xs text-muted-foreground">Used for posting times of new series</p>
              </div>
              <select
                aria-label="Time zone"
                className={`${field} w-48`}
                value={user.timezone}
                onChange={(e) => void save({ timezone: e.target.value }, "Time zone saved")}
              >
                {timezones.map((t) => (
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
        description="Connecting your account opens the platform's own sign-in."
        footer={
          <button className={buttonClass("primary")} onClick={() => setConnecting(null)}>
            Got it
          </button>
        }
      >
        <p className="text-sm text-muted-foreground">
          Connecting {platform?.name ?? "accounts"} arrives together with automatic posting. Until then your videos stay in your library.
        </p>
      </Modal>
      <Confirm
        open={!!disconnect}
        onClose={() => setDisconnect(null)}
        title="Disconnect this account?"
        description="Your series stop posting to it."
        confirmLabel="Disconnect"
        onConfirm={() => disconnect && void removeConnection(disconnect)}
      />
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
