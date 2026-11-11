"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Film, Loader2, Play, Send, Trash2 } from "lucide-react";
import { Scene } from "../art";
import { buttonClass } from "../button";
import { Badge, Card, Confirm, fmtDate, Modal, Toast } from "./ui";
import { type Video, updateDb, useDb } from "@/lib/store";
import { VOICES } from "@/lib/options";

const STATUS = {
  generating: { label: "Generating", tone: "amber" },
  ready: { label: "Ready", tone: "blue" },
  published: { label: "Published", tone: "green" },
} as const;

function downloadFrame(v: Video) {
  const c = document.createElement("canvas");
  c.width = 540;
  c.height = 960;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 960);
  grad.addColorStop(0, `hsl(${v.hue} 70% 75%)`);
  grad.addColorStop(1, `hsl(${v.hue} 60% 20%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 540, 960);
  g.font = "900 56px sans-serif";
  g.textAlign = "center";
  g.lineWidth = 10;
  g.strokeStyle = "#000";
  g.fillStyle = "#fff";
  const word = v.title.split(" ")[0].toUpperCase();
  g.strokeText(word, 270, 480);
  g.fillText(word, 270, 480);
  const a = document.createElement("a");
  a.href = c.toDataURL("image/png");
  a.download = `${v.title.replace(/[^a-z0-9]+/gi, "-")}.png`;
  a.click();
}

/** Plays a video as a captioned slideshow, read aloud by the browser's voice when available. */
function Player({ video, onClose }: { video: Video; onClose: () => void }) {
  const db = useDb();
  const series = db?.series.find((s) => s.id === video.seriesId);
  const words = (series?.niche || video.title).split(/\s+/).filter(Boolean);
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setI((x) => (x + 1) % words.length), 450);
    let utter: SpeechSynthesisUtterance | null = null;
    if ("speechSynthesis" in window && series) {
      const voice = VOICES.find((v) => v.id === series.voice);
      utter = new SpeechSynthesisUtterance(series.niche);
      utter.lang = series.language;
      utter.pitch = voice?.pitch ?? 1;
      utter.rate = voice?.rate ?? 1;
      window.speechSynthesis.speak(utter);
    }
    return () => {
      window.clearInterval(t);
      if (utter) window.speechSynthesis.cancel();
    };
  }, [words.length, series]);

  const caption = series?.captionStyle ?? "bold";
  return (
    <Modal open onClose={onClose} title={video.title} description={series ? `Series: ${series.name}` : undefined}>
      <div className="relative mx-auto w-56 aspect-[9/16] overflow-hidden rounded-xl">
        <Scene variant={video.hue % 8} className="absolute inset-0" />
        <span
          className={`absolute inset-x-0 top-[62%] text-center text-2xl uppercase ${
            caption === "red" ? "caption-word !text-red-500" : caption === "sleek" ? "font-heading font-bold text-white drop-shadow" : "caption-word"
          }`}
        >
          {words[i]}
        </span>
      </div>
    </Modal>
  );
}

export function VideoGrid({ seriesId }: { seriesId?: string }) {
  const db = useDb();
  const [playing, setPlaying] = useState<Video | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  if (!db) return null;
  const videos = db.videos.filter((v) => !seriesId || v.seriesId === seriesId);

  if (videos.length === 0)
    return (
      <Card className="flex flex-col items-center justify-center text-center py-16 px-6">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Film className="h-6 w-6 text-primary" />
        </span>
        <h2 className="text-lg font-semibold">No videos yet</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">Videos appear here as your series create them.</p>
        {!seriesId && (
          <Link href="/dashboard/create/" className={buttonClass("primary", "default", "mt-6")}>
            Create Series
          </Link>
        )}
      </Card>
    );

  const publish = (v: Video) => {
    const s = db.series.find((x) => x.id === v.seriesId);
    const target = s?.platforms.find((p) => db.connected[p]);
    if (!target) {
      setToast("Connect a social account in Settings to publish");
      return;
    }
    updateDb((d) => {
      const x = d.videos.find((y) => y.id === v.id);
      if (x) x.status = "published";
    });
    setToast("Video published");
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {videos.map((v) => {
          const st = STATUS[v.status];
          const series = db.series.find((s) => s.id === v.seriesId);
          return (
            <Card key={v.id} className="overflow-hidden">
              <button
                className="group relative block w-full aspect-[9/16]"
                disabled={v.status === "generating"}
                onClick={() => setPlaying(v)}
                aria-label={`Play ${v.title}`}
              >
                <Scene variant={v.hue % 8} word={v.title.split(" ")[0]} className="absolute inset-0" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                  {v.status === "generating" ? (
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  ) : (
                    <Play className="h-8 w-8 fill-white text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </span>
                <Badge tone={st.tone} className="absolute left-2 top-2">
                  {st.label}
                </Badge>
              </button>
              <div className="p-3 space-y-2">
                <div>
                  <p className="text-sm font-medium truncate">{v.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {series?.name ?? "Deleted series"} · {fmtDate(v.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    className={buttonClass("outline", "sm", "h-8 flex-1 px-2 text-xs")}
                    disabled={v.status !== "ready"}
                    onClick={() => publish(v)}
                  >
                    <Send className="h-3.5 w-3.5" /> Publish
                  </button>
                  <button className={buttonClass("outline", "icon", "h-8 w-8")} disabled={v.status === "generating"} aria-label="Download" onClick={() => downloadFrame(v)}>
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button className={buttonClass("ghost", "icon", "h-8 w-8 text-muted-foreground")} aria-label="Delete video" onClick={() => setRemove(v.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {playing && <Player video={playing} onClose={() => setPlaying(null)} />}
      <Confirm
        open={!!remove}
        onClose={() => setRemove(null)}
        danger
        title="Delete this video?"
        description="It will be removed from your library. Videos already posted stay on your social accounts."
        confirmLabel="Delete"
        onConfirm={() => updateDb((d) => void (d.videos = d.videos.filter((v) => v.id !== remove)))}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
