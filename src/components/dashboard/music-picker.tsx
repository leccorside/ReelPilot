"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Play, Square, Trash2, Upload } from "lucide-react";
import { buttonClass } from "../button";
import { Confirm } from "./ui";
import { api, ApiError, uploadMusicFile, useMusic } from "@/lib/api-client";
import type { MusicTrackDto } from "@/lib/api-types";
import { MAX_TRACKS_PER_SERIES } from "@/lib/limits";

const label = "text-sm font-medium leading-none";
const field =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const MAX_BYTES = 10 * 1024 * 1024;
/** Rows shown before "Show all N tracks" (selected tracks are always among them). */
const COLLAPSED_ROWS = 8;

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function ErrorList({ errors, testId }: { errors: string[]; testId: string }) {
  if (errors.length === 0) return null;
  return (
    <ul role="alert" data-testid={testId} className="space-y-1 text-xs text-destructive">
      {errors.map((e) => (
        // overflow-wrap: anywhere — long links and file names have no spaces to break at.
        <li key={e} className="[overflow-wrap:anywhere]">
          {e}
        </li>
      ))}
    </ul>
  );
}

/**
 * Background music of a series: upload files or import direct links into the user's library,
 * then pick which library tracks the series uses (up to MAX_TRACKS_PER_SERIES).
 */
export function MusicPicker({
  selected,
  onChange,
  onBusyChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { data: library, mutate } = useMusic();
  const fileInput = useRef<HTMLInputElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [urls, setUrls] = useState("");
  const [uploading, setUploading] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  // Separate lists, each shown next to the action that produced it (break-ui #8).
  const [linkErrors, setLinkErrors] = useState<string[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [remove, setRemove] = useState<MusicTrackDto | null>(null);
  const [expanded, setExpanded] = useState(false);
  // Rows of the collapsed list, fixed when the library first loads (selected first) so that ticking a
  // box never makes rows jump or disappear. New uploads are added to it.
  const [pinned, setPinned] = useState<Set<string> | null>(null);

  const busy = uploading.length > 0 || importing;
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  useEffect(() => () => audio.current?.pause(), []);

  useEffect(() => {
    if (!library || pinned) return;
    const first = [...library.filter((t) => selected.includes(t.id)), ...library.filter((t) => !selected.includes(t.id))];
    setPinned(new Set(first.slice(0, Math.max(COLLAPSED_ROWS, selected.length)).map((t) => t.id)));
  }, [library, pinned, selected]);

  // A selection can point to a track that no longer exists (removed in another tab, an old draft):
  // drop it, so the counter and the saved series only use real tracks.
  useEffect(() => {
    if (!library) return;
    const known = selected.filter((id) => library.some((t) => t.id === id));
    if (known.length !== selected.length) onChange(known);
  }, [library, selected, onChange]);

  const full = selected.length >= MAX_TRACKS_PER_SERIES;

  const added = async (tracks: MusicTrackDto[]) => {
    if (tracks.length === 0) return;
    await mutate();
    setPinned((p) => new Set([...(p ?? []), ...tracks.map((t) => t.id)]));
    // New tracks are selected while there is room (break-ui #5).
    const room = MAX_TRACKS_PER_SERIES - selected.length;
    const toSelect = tracks.map((t) => t.id).filter((id) => !selected.includes(id)).slice(0, Math.max(0, room));
    if (toSelect.length) onChange([...selected, ...toSelect]);
  };

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFileErrors([]);
    const files = Array.from(list);
    const problems: string[] = [];
    const ok = files.filter((f) => {
      // Quick checks for a fast answer; the server checks the real content again.
      if (!/\.(mp3|wav)$/i.test(f.name)) problems.push(`${f.name} is not an MP3 or WAV file`);
      else if (f.size > MAX_BYTES) problems.push(`${f.name} is larger than 10MB`);
      else return true;
      return false;
    });
    setUploading((u) => [...u, ...ok.map((f) => f.name)]);
    const done: MusicTrackDto[] = [];
    for (const f of ok) {
      try {
        done.push(await uploadMusicFile(f));
      } catch (e) {
        problems.push(`${f.name}: ${e instanceof ApiError ? e.message : "upload failed"}`);
      } finally {
        setUploading((u) => u.filter((n) => n !== f.name));
      }
    }
    setFileErrors(problems);
    await added(done);
    if (fileInput.current) fileInput.current.value = "";
  };

  const importLinks = async () => {
    const links = urls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (links.length === 0) return;
    setImporting(true);
    setLinkErrors([]);
    const done: MusicTrackDto[] = [];
    const failed: string[] = [];
    const problems: string[] = [];
    for (const url of links) {
      try {
        done.push(await api<MusicTrackDto>("/api/music/import/", { method: "POST", body: { url } }));
      } catch (e) {
        failed.push(url);
        problems.push(`${url}: ${e instanceof ApiError ? e.message : "import failed"}`);
      }
    }
    setUrls(failed.join("\n")); // keep only the links that still need attention
    setLinkErrors(problems);
    setImporting(false);
    await added(done);
  };

  const togglePlay = (t: MusicTrackDto) => {
    audio.current?.pause();
    if (playing === t.id) return setPlaying(null);
    const a = new Audio(t.url);
    a.onended = () => setPlaying(null);
    audio.current = a;
    setPlaying(t.id);
    a.play().catch(() => setPlaying(null));
  };

  const destroy = async (t: MusicTrackDto) => {
    try {
      await api(`/api/music/${t.id}/`, { method: "DELETE" });
      if (playing === t.id) audio.current?.pause();
      onChange(selected.filter((id) => id !== t.id));
      await mutate();
    } catch (e) {
      setFileErrors([e instanceof ApiError ? e.message : "Could not remove the track"]);
    }
  };

  const visible = useMemo(() => {
    if (!library) return [];
    if (expanded || !pinned) return library;
    return library.filter((t) => pinned.has(t.id) || selected.includes(t.id));
  }, [library, expanded, pinned, selected]);
  const hidden = (library?.length ?? 0) - visible.length;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label htmlFor="urls" className={label}>
          Sound file URLs
        </label>
        <textarea
          id="urls"
          rows={3}
          className={field}
          placeholder="Direct links to MP3 or WAV files (https://…/song.mp3), one per line"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          onBlur={(e) => setUrls(e.target.value)}
        />
        <button type="button" className={buttonClass("outline", "sm")} disabled={!urls.trim() || importing} onClick={importLinks}>
          {importing && <Loader2 className="h-4 w-4 animate-spin" />} Import links
        </button>
        <ErrorList errors={linkErrors} testId="link-errors" />
      </div>

      <div className="space-y-3">
        <p className={label}>Upload Sound Files</p>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFiles(e.dataTransfer.files);
          }}
          className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-sm transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
          }`}
        >
          <Upload className="mb-1 h-6 w-6" />
          <span className="font-medium">Click to upload sound files or drag and drop</span>
          <span className="text-muted-foreground">MP3, WAV up to 10MB</span>
        </button>
        <input
          ref={fileInput}
          data-testid="music-file-input"
          type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav"
          multiple
          hidden
          onChange={(e) => void addFiles(e.target.files)}
        />
        {uploading.map((n) => (
          <p key={n} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
            <span className="min-w-0 [overflow-wrap:anywhere]">Uploading {n}…</span>
          </p>
        ))}
        <ErrorList errors={fileErrors} testId="file-errors" />
      </div>

      {library && library.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className={label}>Your music</p>
            <p className={`text-xs tabular-nums ${full ? "font-medium text-foreground" : "text-muted-foreground"}`} data-testid="music-selected-count">
              {selected.length}/{MAX_TRACKS_PER_SERIES} selected
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {full
              ? `A series can use up to ${MAX_TRACKS_PER_SERIES} tracks. Unselect one to pick another.`
              : "Selected tracks play in the background of this series' videos."}
          </p>
          <ul className="divide-y rounded-lg border" aria-label="Your music">
            {visible.map((t) => {
              const on = selected.includes(t.id);
              const locked = !on && full;
              // Play/remove sit under the name on phones (so the name gets the row's width) and at the
              // end of the row from "sm" up. Hidden copies are display:none, so out of the a11y tree.
              const actions = (where: string) => (
                <span className={`shrink-0 gap-1 ${where}`}>
                  <button type="button" className={buttonClass("outline", "icon", "h-8 w-8")} aria-label={`Play ${t.name}`} onClick={() => togglePlay(t)}>
                    {playing === t.id ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  </button>
                  <button
                    type="button"
                    className={buttonClass("ghost", "icon", "h-8 w-8 text-muted-foreground")}
                    aria-label={`Remove ${t.name}`}
                    onClick={() => setRemove(t)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              );
              return (
                // items-start: names can take two lines (break-ui #4).
                <li key={t.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-disabled={locked}
                    disabled={locked}
                    title={locked ? `Up to ${MAX_TRACKS_PER_SERIES} tracks per series` : undefined}
                    aria-label={`Use ${t.name}`}
                    onClick={() => onChange(on ? selected.filter((id) => id !== t.id) : [...selected, t.id])}
                    className={`mt-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-primary disabled:cursor-not-allowed disabled:opacity-40 ${
                      on ? "bg-primary" : ""
                    }`}
                  >
                    {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </button>
                  <span className="min-w-0 flex-1 py-1">
                    <span className="line-clamp-2 [overflow-wrap:anywhere]" title={t.name}>
                      {t.name}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">{sizeLabel(t.sizeBytes)}</span>
                      {actions("flex sm:hidden")}
                    </span>
                  </span>
                  {actions("hidden sm:flex")}
                </li>
              );
            })}
          </ul>
          {(hidden > 0 || expanded) && (
            <button type="button" className={buttonClass("ghost", "sm", "-ml-3")} onClick={() => setExpanded((x) => !x)}>
              {expanded ? "Show fewer" : `Show all ${library.length} tracks`}
            </button>
          )}
        </div>
      )}

      <Confirm
        open={!!remove}
        onClose={() => setRemove(null)}
        danger
        title="Remove this track?"
        description="It is deleted from your library and from every series that uses it."
        confirmLabel="Remove"
        onConfirm={() => remove && void destroy(remove)}
      />
    </div>
  );
}
