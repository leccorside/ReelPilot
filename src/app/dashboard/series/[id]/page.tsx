"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Pause, Play, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Badge, Card, CardHeader, fmtDate, Toast } from "@/components/dashboard/ui";
import { VideoGrid } from "@/components/dashboard/video-grid";
import { buttonClass } from "@/components/button";
import { api, ApiError, refreshDashboard, useMe, useMusic, useSeries } from "@/lib/api-client";
import type { SeriesDto } from "@/lib/api-types";
import { ART_STYLES, CAPTION_STYLES, FORMATS, FREQUENCIES, LANGUAGES, optionName, PLATFORMS, VOICES } from "@/lib/options";

export default function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: s, error, isLoading, mutate } = useSeries(id);
  const { data: me } = useMe();
  const { data: library } = useMusic();
  const music = (library ?? []).filter((t) => s?.musicTrackIds.includes(t.id));
  const [busy, setBusy] = useState<"status" | "generate" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const toggleStatus = async () => {
    if (!s) return;
    setBusy("status");
    try {
      await mutate(await api<SeriesDto>(`/api/series/${s.id}/`, { method: "PATCH", body: { status: s.status === "active" ? "paused" : "active" } }), {
        revalidate: false,
      });
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Could not update the series");
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    if (!s) return;
    setBusy("generate");
    try {
      await api(`/api/series/${s.id}/videos/`, { method: "POST" });
      await refreshDashboard();
      setToast("Video added to the queue");
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Could not create the video");
    } finally {
      setBusy(null);
    }
  };

  const outOfCredits = me !== undefined && me.credits.balance < 1;

  return (
    <DashboardShell crumbs={[{ label: "Series", href: "/dashboard/series/" }, { label: s?.name ?? "Series" }]}>
      {isLoading ? (
        <Card className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Card>
      ) : error || !s ? (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">
            {error instanceof ApiError && error.status === 404 ? "This series doesn't exist anymore." : "Could not load this series. Please reload the page."}
          </p>
          <Link href="/dashboard/series/" className={buttonClass("outline", "default", "mt-4")}>
            Back to series
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={s.name}
              description={`Created ${fmtDate(Date.parse(s.createdAt))} · ${s.status === "active" ? "Posting automatically" : "Paused"}`}
            >
              <div className="flex flex-wrap gap-2">
                <button className={buttonClass("outline", "sm")} disabled={busy !== null} onClick={toggleStatus}>
                  {s.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {s.status === "active" ? "Pause" : "Resume"}
                </button>
                <button
                  className={buttonClass("primary", "sm")}
                  disabled={busy !== null || outOfCredits}
                  title={outOfCredits ? "You are out of credits" : undefined}
                  onClick={generate}
                >
                  {busy === "generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate video
                </button>
              </div>
            </CardHeader>
            <dl className="grid gap-4 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              {[
                ["Niche", s.niche],
                ["Formats", s.formats.map((f) => optionName(FORMATS, f)).join(", ")],
                ["Language & voice", `${optionName(LANGUAGES, s.language)} · ${optionName(VOICES, s.voice)}`],
                ["Art style", optionName(ART_STYLES, s.artStyle)],
                ["Captions", optionName(CAPTION_STYLES, s.captionStyle)],
                ["Background music", s.musicTrackIds.length ? `${s.musicTrackIds.length} track(s)` : "None"],
                ["Posting", `${optionName(FREQUENCIES, s.frequency)} at ${s.postTime} (${s.timezone})`],
                ["Platforms", s.platforms.map((p) => optionName(PLATFORMS, p)).join(", ") || "None"],
              ].map(([k, v]) => (
                <div key={k} className="space-y-1">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium break-words">{v}</dd>
                </div>
              ))}
            </dl>
            {music.length > 0 && (
              <div className="px-6 pb-6 space-y-2">
                <p className="text-sm text-muted-foreground">Music</p>
                <ul className="space-y-2" aria-label="Background music">
                  {music.map((t) => (
                    <li key={t.id} className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                      <audio controls preload="none" src={t.url} className="h-9 w-full sm:w-72" aria-label={`Play ${t.name}`} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="px-6 pb-6">
              <Badge tone={s.status === "active" ? "green" : "gray"}>{s.status === "active" ? "Active" : "Paused"}</Badge>
            </div>
          </Card>
          <div>
            <h2 className="text-lg font-semibold mb-4">Videos</h2>
            <VideoGrid seriesId={s.id} />
          </div>
        </div>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </DashboardShell>
  );
}
