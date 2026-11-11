"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Play, Square } from "lucide-react";
import { Scene } from "../art";
import { buttonClass } from "../button";
import { InstagramIcon, TiktokIcon, YoutubeIcon } from "../icons";
import type { MeDto, SeriesDto, SocialPlatform } from "@/lib/api-types";
import { SERIES_NAME_MAX, SERIES_NICHE_MAX, SERIES_NICHE_MIN } from "@/lib/limits";
import { ART_STYLES, CAPTION_STYLES, FORMATS, FREQUENCIES, type FrequencyId, LANGUAGES, PLATFORMS, TIMEZONES, VOICES } from "@/lib/options";

// The fields of a series, shared by the creation wizard (one block per step) and the edit page
// (all blocks at once), so both look and validate the same way.

export type SeriesForm = {
  formats: string[];
  niche: string;
  language: string;
  voice: string;
  musicTrackIds: string[];
  artStyle: string;
  captionStyle: string;
  name: string;
  platforms: SocialPlatform[];
  frequency: FrequencyId;
  postTime: string;
  timezone: string;
};

export const emptySeriesForm = (): SeriesForm => ({
  formats: [],
  niche: "",
  language: "en",
  voice: "",
  musicTrackIds: [],
  artStyle: "",
  captionStyle: "",
  name: "",
  platforms: [],
  frequency: FREQUENCIES[0].id,
  postTime: "18:00",
  timezone: "UTC",
});

export const formFromSeries = (s: SeriesDto): SeriesForm => ({
  formats: s.formats,
  niche: s.niche,
  language: s.language,
  voice: s.voice,
  musicTrackIds: s.musicTrackIds,
  artStyle: s.artStyle,
  captionStyle: s.captionStyle,
  name: s.name,
  platforms: s.platforms,
  frequency: s.frequency,
  postTime: s.postTime,
  timezone: s.timezone,
});

/** Same rules as the API, checked as the user types. */
export const sectionValid = {
  formats: (f: SeriesForm) => f.formats.length > 0 && f.niche.trim().length >= SERIES_NICHE_MIN && f.niche.trim().length <= SERIES_NICHE_MAX,
  voice: (f: SeriesForm) => !!f.voice,
  art: (f: SeriesForm) => !!f.artStyle,
  caption: (f: SeriesForm) => !!f.captionStyle,
  schedule: (f: SeriesForm) => f.name.trim().length > 0 && f.name.trim().length <= SERIES_NAME_MAX && /^([01]\d|2[0-3]):[0-5]\d$/.test(f.postTime),
};

export const label = "text-sm font-medium leading-none";
export const field =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

type FieldsProps = { value: SeriesForm; set: (patch: Partial<SeriesForm>) => void };

const toggled = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

function Radio({ on }: { on: boolean }) {
  return (
    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary ${on ? "bg-primary" : ""}`}>
      {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
    </span>
  );
}

export function FormatsNicheFields({ value, set }: FieldsProps) {
  return (
    <>
      <div className="space-y-3">
        <p className={label}>Formats</p>
        {/* No fixed height: with 5 options a scroll box only hides the chosen one (break-ui #2). */}
        <div className="rounded-lg border">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => set({ formats: toggled(value.formats, f.id) })}
              className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-muted/50 transition-colors"
            >
              <Radio on={value.formats.includes(f.id)} />
              <span>
                <span className="block text-sm font-medium">{f.name}</span>
                <span className="block text-sm text-muted-foreground">{f.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <label htmlFor="niche" className={label}>
          What do you want your content to be about?
        </label>
        <textarea
          id="niche"
          rows={5}
          maxLength={SERIES_NICHE_MAX}
          aria-describedby="niche-count"
          className={`${field} min-h-[120px]`}
          placeholder="Be as detailed as you want. Tell us exactly what kind of content you want to create. For example: 'Video about the most mysterious unsolved cases in true crime history'"
          value={value.niche}
          onChange={(e) => set({ niche: e.target.value })}
          onBlur={(e) => set({ niche: e.target.value })}
        />
        <p id="niche-count" className="text-right text-xs tabular-nums text-muted-foreground">
          {value.niche.length.toLocaleString("en-US")}/{SERIES_NICHE_MAX.toLocaleString("en-US")}
        </p>
      </div>
    </>
  );
}

export function LanguageVoiceFields({ value, set }: FieldsProps) {
  const [previewing, setPreviewing] = useState<string | null>(null);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  // Browser voice for now; the real narrator voices arrive with Kokoro (Passo 7).
  const preview = (id: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (previewing === id) return setPreviewing(null);
    const v = VOICES.find((x) => x.id === id)!;
    const u = new SpeechSynthesisUtterance(`Hi, I'm ${v.name}. I will narrate your faceless videos.`);
    u.lang = value.language;
    u.pitch = v.pitch;
    u.rate = v.rate;
    u.onend = () => setPreviewing(null);
    setPreviewing(id);
    window.speechSynthesis.speak(u);
  };

  return (
    <>
      <div className="space-y-3">
        <label htmlFor="lang" className={label}>
          Language
        </label>
        <select id="lang" className={`${field} h-10`} value={value.language} onChange={(e) => set({ language: e.target.value })} onBlur={(e) => set({ language: e.target.value })}>
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.flag} {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-3">
        <p className={label}>Voice Style</p>
        {/* No fixed height, for the same reason as the formats (break-ui #3). */}
        <div className="rounded-lg border px-4">
          {VOICES.map((v) => (
            <div key={v.id} className="flex items-center gap-3 border-b py-4 last:border-0">
              <button type="button" className="flex flex-1 items-start gap-3 text-left" onClick={() => set({ voice: v.id })}>
                <Radio on={value.voice === v.id} />
                <span>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {v.name}
                    <span className={`rounded-full border px-2 text-xs ${v.gender === "Male" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-pink-200 bg-pink-50 text-pink-700"}`}>
                      {v.gender}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{v.desc}</span>
                </span>
              </button>
              <button type="button" className={buttonClass("outline", "icon", "h-9 w-9 shrink-0")} aria-label={`Preview ${v.name}`} onClick={() => preview(v.id)}>
                {previewing === v.id ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function ArtStyleField({ value, set }: FieldsProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {ART_STYLES.map((a) => (
        <button key={a.id} type="button" onClick={() => set({ artStyle: a.id })} className="w-40 shrink-0 text-left">
          <span className={`relative block aspect-[9/16] overflow-hidden rounded-lg ring-offset-2 ${value.artStyle === a.id ? "ring-2 ring-primary" : ""}`}>
            <Scene variant={a.variant} className="absolute inset-0" />
            {value.artStyle === a.id && (
              <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                <Check className="h-4 w-4 text-white" strokeWidth={3} />
              </span>
            )}
          </span>
          <span className="mt-2 block text-sm font-medium">{a.name}</span>
        </button>
      ))}
    </div>
  );
}

function CaptionSample({ id }: { id: string }) {
  return (
    <div className="flex h-[88px] items-center justify-center rounded-md bg-gradient-to-b from-zinc-500 to-zinc-800 px-2 text-center leading-tight">
      {id === "bold" && <span className="caption-word text-2xl">SAMPLETEXT</span>}
      {id === "red" && (
        <span className="font-heading text-2xl font-black uppercase leading-tight">
          <span className="text-red-500 [-webkit-text-stroke:1px_#000]">Sample</span>
          <br />
          <span className="text-white [-webkit-text-stroke:1px_#000]">Text</span>
        </span>
      )}
      {id === "sleek" && (
        <span className="font-heading text-xl font-bold uppercase leading-tight text-white drop-shadow">
          Sample
          <br />
          Text
        </span>
      )}
    </div>
  );
}

export function CaptionStyleField({ value, set }: FieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {CAPTION_STYLES.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => set({ captionStyle: c.id })}
          className={`relative rounded-lg border-2 p-4 text-left transition-colors ${value.captionStyle === c.id ? "border-primary" : "border-border hover:border-muted-foreground/40"}`}
        >
          <CaptionSample id={c.id} />
          <span className="mt-3 block text-sm font-medium">{c.name}</span>
          {value.captionStyle === c.id && (
            <span className="absolute right-6 top-6 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
              <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

const PLATFORM_ICON = { tiktok: TiktokIcon, instagram: InstagramIcon, youtube: YoutubeIcon } as const;

/** Name, platforms, frequency and time. The time zone selector is shown on the edit page only. */
export function ScheduleFields({ value, set, me, showTimezone = false }: FieldsProps & { me: MeDto | undefined; showTimezone?: boolean }) {
  const connection = (platform: string) => me?.connections.find((c) => c.platform === platform);
  const connected = (platform: string) => connection(platform)?.status === "active";
  const timezones = TIMEZONES.includes(value.timezone) ? TIMEZONES : [value.timezone, ...TIMEZONES];
  return (
    <>
      <div className="space-y-3">
        <label htmlFor="name" className={label}>
          Series name
        </label>
        <input
          id="name"
          maxLength={SERIES_NAME_MAX}
          className={`${field} h-10`}
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          onBlur={(e) => set({ name: e.target.value })}
          placeholder="e.g. history"
        />
      </div>
      <div className="space-y-3">
        <p className={label}>Post to</p>
        {/* grid-cols-1 = minmax(0, 1fr): a long channel name truncates instead of widening the page (break-ui #1). */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PLATFORMS.map((p) => {
            const Icon = PLATFORM_ICON[p.id as keyof typeof PLATFORM_ICON];
            const on = value.platforms.includes(p.id as SocialPlatform);
            const conn = connection(p.id);
            const expired = !!conn && conn.status !== "active";
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => set({ platforms: toggled(value.platforms, p.id as SocialPlatform) })}
                className={`flex min-w-0 items-center gap-3 rounded-lg border-2 p-3 text-left ${on ? "border-primary" : "border-border"}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{p.name}</span>
                  <span title={conn?.username} className="block truncate text-xs text-muted-foreground">
                    {conn?.username ?? "Not connected"}
                  </span>
                  {/* Own line: appended to a long handle it would be truncated away (break-ui #7). */}
                  {expired && <span className="block text-xs font-medium text-amber-700">Reconnect needed</span>}
                </span>
              </button>
            );
          })}
        </div>
        {value.platforms.some((p) => !connected(p)) && (
          <p className="text-xs text-muted-foreground">
            Videos are kept in your library until you connect the account in{" "}
            <Link href="/dashboard/settings/" className="underline">
              Settings
            </Link>
            .
          </p>
        )}
      </div>
      <div className={`grid gap-4 ${showTimezone ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <div className="space-y-3">
          <label htmlFor="freq" className={label}>
            Posting frequency
          </label>
          <select
            id="freq"
            className={`${field} h-10`}
            value={value.frequency}
            onChange={(e) => set({ frequency: e.target.value as FrequencyId })}
            onBlur={(e) => set({ frequency: e.target.value as FrequencyId })}
          >
            {FREQUENCIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          <label htmlFor="time" className={label}>
            Posting time
          </label>
          <input id="time" type="time" className={`${field} h-10`} value={value.postTime} onChange={(e) => set({ postTime: e.target.value })} onBlur={(e) => set({ postTime: e.target.value })} />
        </div>
        {showTimezone && (
          <div className="space-y-3">
            <label htmlFor="tz" className={label}>
              Time zone
            </label>
            <select id="tz" className={`${field} h-10`} value={value.timezone} onChange={(e) => set({ timezone: e.target.value })}>
              {timezones.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </>
  );
}
