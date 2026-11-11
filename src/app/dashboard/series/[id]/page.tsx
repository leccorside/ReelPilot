"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Pause, Play, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Badge, Card, CardHeader, fmtDate, Toast } from "@/components/dashboard/ui";
import { VideoGrid } from "@/components/dashboard/video-grid";
import { buttonClass } from "@/components/button";
import { generateVideo, updateDb, useDb } from "@/lib/store";
import { ART_STYLES, CAPTION_STYLES, FORMATS, LANGUAGES, PLATFORMS, VOICES } from "@/lib/options";

export default function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const db = useDb();
  const [toast, setToast] = useState<string | null>(null);
  const s = db?.series.find((x) => x.id === id);

  const name = (list: { id: string; name: string }[], v: string) => list.find((x) => x.id === v)?.name ?? v;

  return (
    <DashboardShell crumbs={[{ label: "Series", href: "/dashboard/series/" }, { label: s?.name ?? "Series" }]}>
      {!db ? null : !s ? (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">This series doesn&apos;t exist anymore.</p>
          <Link href="/dashboard/series/" className={buttonClass("outline", "default", "mt-4")}>
            Back to series
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader title={s.name} description={`Created ${fmtDate(s.createdAt)} · ${s.status === "active" ? "Posting automatically" : "Paused"}`}>
              <div className="flex flex-wrap gap-2">
                <button
                  className={buttonClass("outline", "sm")}
                  onClick={() =>
                    updateDb((d) => {
                      const x = d.series.find((y) => y.id === s.id);
                      if (x) x.status = x.status === "active" ? "paused" : "active";
                    })
                  }
                >
                  {s.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {s.status === "active" ? "Pause" : "Resume"}
                </button>
                <button
                  className={buttonClass("primary", "sm")}
                  disabled={db.credits < 1}
                  onClick={() => setToast(generateVideo(s.id) ? "Generating a new video…" : "You are out of credits")}
                >
                  <Sparkles className="h-4 w-4" /> Generate video
                </button>
              </div>
            </CardHeader>
            <dl className="grid gap-4 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              {[
                ["Niche", s.niche],
                ["Formats", s.formats.map((f) => name(FORMATS, f)).join(", ")],
                ["Language & voice", `${name(LANGUAGES, s.language)} · ${name(VOICES, s.voice)}`],
                ["Art style", name(ART_STYLES, s.artStyle)],
                ["Captions", name(CAPTION_STYLES, s.captionStyle)],
                ["Background music", `${s.musicUrls.length + s.musicFiles.length} track(s)`],
                ["Posting", `${s.frequency} at ${s.postTime}`],
                ["Platforms", s.platforms.map((p) => name(PLATFORMS, p)).join(", ") || "None"],
              ].map(([k, v]) => (
                <div key={k} className="space-y-1">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium break-words">{v}</dd>
                </div>
              ))}
            </dl>
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
