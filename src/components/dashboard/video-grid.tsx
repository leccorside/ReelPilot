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
  const { data: videos, error, isLoading, hasMore, isLoadingMore, loadMore } = useVideos(seriesId);
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
  else
    body = (
      <>
        <VideoCards videos={videos} onDelete={setRemove} />
        {/* The API returns 50 videos at a time; older ones come with "Load more" (break-ui #2). */}
        {hasMore && (
          <div className="mt-6 flex justify-center">
            <button type="button" className={buttonClass("outline")} onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Load more videos
            </button>
          </div>
        )}
      </>
    );

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

/** "#1284" from "<series name> #1284" (null when the series was renamed after the video was made). */
function videoNumber(v: VideoDto): string | null {
  if (!v.title.startsWith(v.seriesName)) return null;
  const rest = v.title.slice(v.seriesName.length).trim();
  return /^#\d+$/.test(rest) ? rest : null;
}

const duration = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")}`;

function VideoCards({ videos, onDelete }: { videos: VideoDto[]; onDelete: (v: VideoDto) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {videos.map((v) => {
          const st = STATUS[v.status];
          const working = IN_PROGRESS.includes(v.status);
          const number = videoNumber(v);
          const name = number ? v.seriesName : v.title;
          return (
            // Column layout: the actions sit at the bottom of every card, aligned across a row (#8).
            <Card key={v.id} className="flex flex-col overflow-hidden" data-testid="video-card">
              <div className="relative block w-full aspect-[9/16]">
                {/* Placeholder art until real thumbnails: the video number, short and unique (#6, #9). */}
                <Scene variant={hueFor(v.id) % 8} word={number ?? undefined} className="absolute inset-0" />
                {/* Status icons at the bottom, never over the number. */}
                <span className="absolute inset-x-0 bottom-4 flex justify-center">
                  {working && <Loader2 className="h-7 w-7 animate-spin text-white drop-shadow" aria-hidden />}
                  {v.status === "failed" && <AlertTriangle className="h-7 w-7 text-white drop-shadow" aria-hidden />}
                </span>
                <Badge tone={st.tone} className="absolute left-2 top-2">
                  {st.label}
                </Badge>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="min-w-0">
                  {/* The series name may be cut; the video number never is (#3, #7). */}
                  <p className="flex min-w-0 text-sm font-medium" title={v.title}>
                    <span dir="auto" className="truncate">
                      {name}
                    </span>
                    {number && <bdi className="shrink-0 pl-1 tabular-nums">{number}</bdi>}
                  </p>
                  {/* Only the date (and length): the series is already in the title, and dates are never cut (#4). */}
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {fmtDate(Date.parse(v.createdAt))}
                    {v.durationMs ? ` · ${duration(v.durationMs)}` : ""}
                  </p>
                  {v.status === "failed" && (
                    <>
                      {v.error && (
                        <p className="mt-1 text-xs text-destructive line-clamp-2 [overflow-wrap:anywhere]" title={v.error}>
                          {v.error}
                        </p>
                      )}
                      {/* Own line, so it is never clamped away with a long error (#5). */}
                      <p className="mt-0.5 text-xs font-medium text-muted-foreground">Credit refunded</p>
                    </>
                  )}
                </div>
                {/* Icon buttons that never shrink: all three fit in a 136px card (#1). */}
                <div className="mt-auto flex items-center gap-1">
                  <button className={buttonClass("outline", "icon", "h-8 w-8 shrink-0")} disabled title={NOT_YET.publish} aria-label="Publish">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                  <button className={buttonClass("outline", "icon", "h-8 w-8 shrink-0")} disabled title={NOT_YET.download} aria-label="Download">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className={buttonClass("ghost", "icon", "ml-auto h-8 w-8 shrink-0 text-muted-foreground")}
                    aria-label="Delete video"
                    onClick={() => onDelete(v)}
                  >
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
