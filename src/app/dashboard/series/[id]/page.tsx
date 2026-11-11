"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Pause, Pencil, Play, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Badge, Card, CardHeader, fmtDate, Toast } from "@/components/dashboard/ui";
import { VideoGrid } from "@/components/dashboard/video-grid";
import { buttonClass } from "@/components/button";
import { api, ApiError, refreshDashboard, useMe, useMusic, useSeries } from "@/lib/api-client";
import type { MeDto, SeriesDto } from "@/lib/api-types";
import { ART_STYLES, CAPTION_STYLES, FORMATS, FREQUENCIES, LANGUAGES, optionName, PLATFORMS, VOICES } from "@/lib/options";
import { platformStates, seriesStatusLine } from "@/lib/series-status";

export default function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: s, error, isLoading, mutate } = useSeries(id);
  const { data: me } = useMe();
  const { data: library } = useMusic();
  const music = (library ?? []).filter((t) => s?.musicTrackIds.includes(t.id));
  const [busy, setBusy] = useState<"status" | "generate" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  // Coming from the edit page (?saved=1) or from the wizard when the first video couldn't be queued
  // (?first=no-credits|failed): say so once, then clean the address.
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const first = params.get("first");
    if (params.get("saved") === "1") setToast("Changes saved");
    if (first === "no-credits") setNotice("Your series is ready, but its first video wasn't made because you're out of credits. Generate it here when you have credits again.");
    if (first === "failed") setNotice("Your series is ready, but its first video couldn't be queued. Use “Generate video” to try again.");
    if (params.has("saved") || params.has("first")) router.replace(`/dashboard/series/${id}/`);
  }, [id, router]);

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
          {notice && (
            <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {notice}
            </p>
          )}
          <Card data-testid="series-card">
            {/* Status once, next to the name, and a line that says what the series really does (#3, #9). */}
            <CardHeader
              title={s.name}
              badge={<Badge tone={s.status === "active" ? "green" : "gray"}>{s.status === "active" ? "Active" : "Paused"}</Badge>}
              description={`Created ${fmtDate(Date.parse(s.createdAt))} · ${seriesStatusLine(s, me)}`}
            >
              <div className="flex flex-wrap gap-2">
                <Link href={`/dashboard/series/${s.id}/edit/`} className={buttonClass("outline", "sm")}>
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
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
            {/* The reason the button is disabled, visible on touch screens too (#5). */}
            {outOfCredits && (
              <p role="note" className="mx-6 mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                You&apos;re out of credits, so no new video can be made.{" "}
                <Link href="/dashboard/billing/" className="font-medium underline">
                  Get more credits
                </Link>
              </p>
            )}
            <dl className="grid gap-4 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              {/* The niche is the series' brief: its own full-width row, clamped (#6). */}
              <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                <dt className="text-muted-foreground">Niche</dt>
                <dd className="font-medium">
                  <ClampedText text={s.niche} />
                </dd>
              </div>
              {(
                [
                  ["Formats", s.formats.map((f) => optionName(FORMATS, f)).join(", ")],
                  ["Language & voice", `${optionName(LANGUAGES, s.language)} · ${optionName(VOICES, s.voice)}`],
                  ["Art style", optionName(ART_STYLES, s.artStyle)],
                  ["Captions", optionName(CAPTION_STYLES, s.captionStyle)],
                  ["Background music", s.musicTrackIds.length ? `${s.musicTrackIds.length} ${s.musicTrackIds.length === 1 ? "track" : "tracks"}` : "None"],
                  ["Posting", `${optionName(FREQUENCIES, s.frequency)} at ${s.postTime} (${s.timezone})${s.status === "paused" ? " · paused" : ""}`],
                  ["Platforms", <Platforms key="p" platforms={s.platforms} connections={me?.connections} />],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="space-y-1">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium [overflow-wrap:anywhere]">{v}</dd>
                </div>
              ))}
            </dl>
            {music.length > 0 && (
              <div className="px-6 pb-6 space-y-2">
                <p className="text-sm text-muted-foreground">Music</p>
                <ul className="space-y-2" aria-label="Background music">
                  {music.map((t) => (
                    // The player sits under the name until there is room for both (#7).
                    <li key={t.id} className="flex flex-col gap-2 rounded-md border px-3 py-2 lg:flex-row lg:items-center">
                      <span className="min-w-0 flex-1 text-sm font-medium line-clamp-2 [overflow-wrap:anywhere]" title={t.name}>
                        {t.name}
                      </span>
                      <audio controls preload="none" src={t.url} className="h-9 w-full shrink-0 lg:w-72" aria-label={`Play ${t.name}`} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
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

/** Selected platforms, flagging the ones whose account isn't connected (#4). */
function Platforms({ platforms, connections }: { platforms: string[]; connections: MeDto["connections"] | undefined }) {
  if (platforms.length === 0) return <>None</>;
  // While the account loads, only the names (no warning that could turn out wrong).
  const states = connections ? platformStates(platforms, connections) : platforms.map((id) => ({ id, name: optionName(PLATFORMS, id), connected: true }));
  const off = states.some((p) => !p.connected);
  return (
    <>
      {states.map((p, i) => (
        <span key={p.id}>
          {i > 0 && ", "}
          {p.name}
          {!p.connected && <span className="font-normal text-amber-700"> (not connected)</span>}
        </span>
      ))}
      {off && (
        <Link href="/dashboard/settings/" className="block text-xs font-normal text-primary underline">
          Connect in Settings
        </Link>
      )}
    </>
  );
}

/** Long text clamped to 4 lines, with "Show more" only when something is actually hidden. */
function ClampedText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const check = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open]);
  return (
    <>
      <span ref={ref} id="series-niche" className={`whitespace-pre-line [overflow-wrap:anywhere] ${open ? "block" : "line-clamp-4"}`}>
        {text}
      </span>
      {(clipped || open) && (
        <button type="button" aria-expanded={open} aria-controls="series-niche" className="mt-1 text-xs font-medium text-primary underline" onClick={() => setOpen((o) => !o)}>
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}
