"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Play, Square, Trash2, Upload } from "lucide-react";
import { buttonClass } from "../button";
import { Confirm } from "./ui";
import { api, ApiError, uploadMusicFile, useMusic } from "@/lib/api-client";
import type { MusicTrackDto } from "@/lib/api-types";

const label = "text-sm font-medium leading-none";
const field =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const MAX_BYTES = 10 * 1024 * 1024;

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Background music of a series: upload files or import direct links into the user's library,
 * then pick which library tracks the series uses.
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
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [remove, setRemove] = useState<MusicTrackDto | null>(null);

  const busy = uploading.length > 0 || importing;
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  useEffect(() => () => audio.current?.pause(), []);

  const added = async (tracks: MusicTrackDto[]) => {
    if (tracks.length === 0) return;
    await mutate();
    onChange(Array.from(new Set([...selected, ...tracks.map((t) => t.id)])));
  };

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setErrors([]);
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
    setErrors(problems);
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
    setErrors([]);
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
    setErrors(problems);
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
      setErrors([e instanceof ApiError ? e.message : "Could not remove the track"]);
    }
  };

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
          <p key={n} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading {n}…
          </p>
        ))}
        {errors.length > 0 && (
          <ul role="alert" className="space-y-1 text-xs text-destructive">
            {errors.map((e) => (
              <li key={e} className="break-words">
                {e}
              </li>
            ))}
          </ul>
        )}
      </div>

      {library && library.length > 0 && (
        <div className="space-y-3">
          <p className={label}>Your music</p>
          <p className="text-xs text-muted-foreground">Selected tracks play in the background of this series&apos; videos.</p>
          <ul className="divide-y rounded-lg border" aria-label="Your music">
            {library.map((t) => {
              const on = selected.includes(t.id);
              return (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`Use ${t.name}`}
                    onClick={() => onChange(on ? selected.filter((id) => id !== t.id) : [...selected, t.id])}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border border-primary ${on ? "bg-primary" : ""}`}
                  >
                    {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </button>
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{sizeLabel(t.sizeBytes)}</span>
                  <button type="button" className={buttonClass("outline", "icon", "h-8 w-8 shrink-0")} aria-label={`Play ${t.name}`} onClick={() => togglePlay(t)}>
                    {playing === t.id ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  </button>
                  <button
                    type="button"
                    className={buttonClass("ghost", "icon", "h-8 w-8 shrink-0 text-muted-foreground")}
                    aria-label={`Remove ${t.name}`}
                    onClick={() => setRemove(t)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
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
