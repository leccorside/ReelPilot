"use client";

import Link from "next/link";
import { useState } from "react";
import { Calendar, Layers, Loader2, Pause, Play, Plus, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Badge, Card, Confirm, fmtDate, Toast } from "@/components/dashboard/ui";
import { buttonClass } from "@/components/button";
import { api, ApiError, refreshDashboard, useSeriesList } from "@/lib/api-client";
import type { SeriesDto } from "@/lib/api-types";

export default function SeriesPage() {
  const { data: series, error, isLoading, mutate } = useSeriesList();
  const [remove, setRemove] = useState<SeriesDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const toggle = async (s: SeriesDto) => {
    setBusy(s.id);
    try {
      const updated = await api<SeriesDto>(`/api/series/${s.id}/`, { method: "PATCH", body: { status: s.status === "active" ? "paused" : "active" } });
      await mutate((list) => list?.map((x) => (x.id === s.id ? updated : x)), { revalidate: false });
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Could not update the series");
    } finally {
      setBusy(null);
    }
  };

  const destroy = async (s: SeriesDto) => {
    try {
      await api(`/api/series/${s.id}/`, { method: "DELETE" });
      await refreshDashboard(); // queued videos may have been refunded
      setToast("Series deleted");
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Could not delete the series");
    }
  };

  return (
    <DashboardShell
      crumbs={[{ label: "Dashboard", href: "/dashboard/series/" }, { label: "Series" }]}
      actions={
        <Link href="/dashboard/create/" className={buttonClass("primary", "sm", "shrink-0")} aria-label="Create Series">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Create Series</span>
        </Link>
      }
    >
      {isLoading ? (
        <Card className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Card>
      ) : error ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Could not load your series. Please reload the page.</Card>
      ) : !series || series.length === 0 ? (
        <Card className="flex flex-col items-center justify-center text-center py-16 px-6">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Layers className="h-6 w-6 text-primary" />
          </span>
          <h2 className="text-lg font-semibold">No series yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            A series creates and posts videos about one topic on autopilot. Create your first one to get started.
          </p>
          <Link href="/dashboard/create/" className={buttonClass("primary", "default", "mt-6")}>
            <Plus className="h-4 w-4" /> Create Series
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Below lg (phones, tablets, 200% zoom) the table no longer fits next to the sidebar: a stacked
              list keeps name, status, numbers and actions visible (#2). */}
          <ul className="divide-y lg:hidden" aria-label="Your series">
            {series.map((s) => (
              <li key={s.id} className="space-y-2 px-4 py-3">
                <div className="flex items-start gap-2">
                  <SeriesName s={s} className="flex-1" />
                  {s.status === "paused" && <Badge tone="gray" className="shrink-0">Paused</Badge>}
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Created {fmtDate(Date.parse(s.createdAt))} · {videosLabel(s.publishedCount)} published
                </p>
                <div className="flex items-center gap-2">
                  <PauseButton s={s} busy={busy === s.id} onToggle={toggle} />
                  <button className={buttonClass("ghost", "icon", "ml-auto h-9 w-9 shrink-0 text-muted-foreground")} aria-label={`Delete ${s.name}`} onClick={() => setRemove(s)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="h-12 px-4 font-medium">Name</th>
                  <th className="h-12 px-4 font-medium">Created</th>
                  <th className="h-12 px-4 font-medium">Published</th>
                  <th className="h-12 px-4 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    {/* Wraps (2 lines max) instead of widening the table and pushing the actions out (#1). */}
                    <td className="w-full min-w-[10rem] max-w-[28rem] px-4 py-3">
                      <div className="flex items-start gap-2">
                        <SeriesName s={s} />
                        {s.status === "paused" && <Badge tone="gray" className="shrink-0">Paused</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0" />
                        {fmtDate(Date.parse(s.createdAt))}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{videosLabel(s.publishedCount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <PauseButton s={s} busy={busy === s.id} onToggle={toggle} />
                        <button className={buttonClass("ghost", "icon", "h-9 w-9 shrink-0 text-muted-foreground")} aria-label={`Delete ${s.name}`} onClick={() => setRemove(s)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Confirm
        open={!!remove}
        onClose={() => setRemove(null)}
        danger
        title="Delete this series?"
        description="It stops creating videos and its videos are removed from your library. Credits of videos still waiting in the queue come back. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => remove && void destroy(remove)}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </DashboardShell>
  );
}

const numberFormat = new Intl.NumberFormat("en-US");

/** "No videos", "1 video", "1,284 videos" (#4). */
function videosLabel(n: number) {
  if (n === 0) return "No videos";
  return `${numberFormat.format(n)} ${n === 1 ? "video" : "videos"}`;
}

function SeriesName({ s, className = "" }: { s: SeriesDto; className?: string }) {
  return (
    <Link href={`/dashboard/series/${s.id}/`} title={s.name} dir="auto" className={`min-w-0 font-medium hover:underline line-clamp-2 [overflow-wrap:anywhere] ${className}`}>
      {s.name}
    </Link>
  );
}

/** Width from its content (min-w, not w): translated labels never overflow (#7). */
function PauseButton({ s, busy, onToggle }: { s: SeriesDto; busy: boolean; onToggle: (s: SeriesDto) => void }) {
  return (
    <button className={buttonClass("outline", "sm", "min-w-24 shrink-0")} disabled={busy} onClick={() => onToggle(s)}>
      {s.status === "active" ? (
        <>
          <Pause className="h-3.5 w-3.5 fill-current" /> Pause
        </>
      ) : (
        <>
          <Play className="h-3.5 w-3.5 fill-current" /> Resume
        </>
      )}
    </button>
  );
}
