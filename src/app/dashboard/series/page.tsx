"use client";

import Link from "next/link";
import { useState } from "react";
import { Calendar, Layers, Pause, Play, Plus, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Badge, Card, Confirm, fmtDate, Toast } from "@/components/dashboard/ui";
import { buttonClass } from "@/components/button";
import { updateDb, useDb } from "@/lib/store";

export default function SeriesPage() {
  const db = useDb();
  const [remove, setRemove] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const series = db?.series ?? [];

  const toggle = (id: string) => {
    updateDb((d) => {
      const s = d.series.find((x) => x.id === id);
      if (s) s.status = s.status === "active" ? "paused" : "active";
    });
  };

  return (
    <DashboardShell
      crumbs={[{ label: "Dashboard", href: "/dashboard/series/" }, { label: "Series" }]}
      actions={
        <Link href="/dashboard/create/" className={buttonClass("primary", "sm")}>
          <Plus className="h-4 w-4" /> Create Series
        </Link>
      }
    >
      {series.length === 0 ? (
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="h-12 px-4 font-medium">Name</th>
                  <th className="h-12 px-4 font-medium">Type</th>
                  <th className="h-12 px-4 font-medium">Created</th>
                  <th className="h-12 px-4 font-medium">Published</th>
                  <th className="h-12 px-4 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s) => {
                  const count = db!.videos.filter((v) => v.seriesId === s.id && v.status === "published").length;
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/series/${s.id}/`} className="hover:underline">
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge>{s.type}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {fmtDate(s.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{count} video(s)</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button className={buttonClass("outline", "sm", "w-24")} onClick={() => toggle(s.id)}>
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
                          <button className={buttonClass("ghost", "icon", "h-9 w-9 text-muted-foreground")} aria-label={`Delete ${s.name}`} onClick={() => setRemove(s.id)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
        description="It stops creating videos and its videos are removed from your library. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          updateDb((d) => {
            d.series = d.series.filter((s) => s.id !== remove);
            d.videos = d.videos.filter((v) => v.seriesId !== remove);
          });
          setToast("Series deleted");
        }}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </DashboardShell>
  );
}
