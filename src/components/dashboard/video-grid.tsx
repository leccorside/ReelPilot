"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Download, Film, Loader2, Send, Trash2 } from "lucide-react";
import { Scene } from "../art";
import { buttonClass } from "../button";
import { Badge, Card, Confirm, fmtDate, Toast } from "./ui";
import { api, ApiError, hueFor, refreshDashboard, useVideos } from "@/lib/api-client";
import { IN_PROGRESS, type VideoDto, type VideoStatus } from "@/lib/api-types";

const STATUS: Record<VideoStatus, { label: string; tone: "amber" | "blue" | "green" | "red" | "gray" }> = {
  queued: { label: "In queue", tone: "gray" },
  scripting: { label: "Writing script", tone: "amber" },
  voicing: { label: "Recording voice", tone: "amber" },
  imaging: { label: "Creating images", tone: "amber" },
  rendering: { label: "Rendering", tone: "amber" },
  ready: { label: "Ready", tone: "blue" },
  publishing: { label: "Publishing", tone: "amber" },
  published: { label: "Published", tone: "green" },
  failed: { label: "Failed", tone: "red" },
};

/** Why an action is not available yet (the buttons stay visible but disabled, with this as a tooltip). */
const NOT_YET = {
  publish: "Publishing to your social accounts arrives with automatic posting",
  download: "Available when the video file is ready",
};

export function VideoGrid({ seriesId }: { seriesId?: string }) {
  const { data: videos, error, isLoading } = useVideos(seriesId);
  const [remove, setRemove] = useState<VideoDto | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const destroy = async (v: VideoDto) => {
    try {
      const { refunded } = await api<{ refunded: boolean }>(`/api/videos/${v.id}/`, { method: "DELETE" });
      await refreshDashboard();
      setToast(refunded ? "Video deleted. Its credit is back." : "Video deleted");
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Could not delete the video");
    }
  };

  // The dialogs and the toast stay mounted in every state: deleting the last video empties the
  // list, and its confirmation ("credit is back") must still be shown.
  let body: React.ReactNode;
  if (isLoading)
    body = (
      <Card className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    );
  else if (error) body = <Card className="p-10 text-center text-sm text-muted-foreground">Could not load your videos. Please reload the page.</Card>;
  else if (!videos || videos.length === 0)
    body = (
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
  else body = <VideoCards videos={videos} onDelete={setRemove} />;

  return (
    <>
      {body}
      <Confirm
        open={!!remove}
        onClose={() => setRemove(null)}
        danger
        title="Delete this video?"
        description={
          remove?.status === "queued"
            ? "It hasn't been made yet, so its credit comes back."
            : "It will be removed from your library. Videos already posted stay on your social accounts."
        }
        confirmLabel="Delete"
        onConfirm={() => remove && void destroy(remove)}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}

function VideoCards({ videos, onDelete }: { videos: VideoDto[]; onDelete: (v: VideoDto) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {videos.map((v) => {
          const st = STATUS[v.status];
          const working = IN_PROGRESS.includes(v.status);
          return (
            <Card key={v.id} className="overflow-hidden" data-testid="video-card">
              <div className="relative block w-full aspect-[9/16]">
                <Scene variant={hueFor(v.id) % 8} word={v.title.split(" ")[0]} className="absolute inset-0" />
                <span className="absolute inset-0 flex items-center justify-center">
                  {working && <Loader2 className="h-8 w-8 animate-spin text-white" />}
                  {v.status === "failed" && <AlertTriangle className="h-8 w-8 text-white" />}
                </span>
                <Badge tone={st.tone} className="absolute left-2 top-2">
                  {st.label}
                </Badge>
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <p className="text-sm font-medium truncate">{v.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {v.seriesName} · {fmtDate(Date.parse(v.createdAt))}
                  </p>
                  {v.status === "failed" && v.error && (
                    <p className="mt-1 text-xs text-destructive line-clamp-2" title={v.error}>
                      {v.error} — credit refunded.
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button className={buttonClass("outline", "sm", "h-8 flex-1 px-2 text-xs")} disabled title={NOT_YET.publish}>
                    <Send className="h-3.5 w-3.5" /> Publish
                  </button>
                  <button className={buttonClass("outline", "icon", "h-8 w-8")} disabled title={NOT_YET.download} aria-label="Download">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button className={buttonClass("ghost", "icon", "h-8 w-8 text-muted-foreground")} aria-label="Delete video" onClick={() => onDelete(v)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {videos.some((v) => v.status === "queued") && (
        <p className="mt-4 text-xs text-muted-foreground">
          Videos in the queue start as soon as the video engine is online. Deleting a video that is still in the queue gives its credit back.
        </p>
      )}
    </>
  );
}
