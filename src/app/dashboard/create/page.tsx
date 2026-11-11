"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Loader2, Play, Square } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { MusicPicker } from "@/components/dashboard/music-picker";
import { Scene } from "@/components/art";
import { buttonClass } from "@/components/button";
import { InstagramIcon, TiktokIcon, YoutubeIcon } from "@/components/icons";
import { api, ApiError, refreshDashboard, useMe } from "@/lib/api-client";
import type { SeriesDto } from "@/lib/api-types";
import { ART_STYLES, CAPTION_STYLES, FORMATS, FREQUENCIES, type FrequencyId, LANGUAGES, PLATFORMS, VOICES } from "@/lib/options";

const STEPS = ["Choose Formats & Niche", "Language & Voice", "Background Music", "Art Style", "Caption Style", "Schedule & Publish"];
const PLATFORM_ICON = { tiktok: TiktokIcon, instagram: InstagramIcon, youtube: YoutubeIcon } as const;

const label = "text-sm font-medium leading-none";
const field =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function Radio({ on }: { on: boolean }) {
  return (
    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary ${on ? "bg-primary" : ""}`}>
      {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
    </span>
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

export default function CreateSeriesPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const connected = (platform: string) => me?.connections.find((c) => c.platform === platform && c.status === "active")?.username;
  const [step, setStep] = useState(0);
  const [formats, setFormats] = useState<string[]>([]);
  const [niche, setNiche] = useState("");
  const [language, setLanguage] = useState("en");
  const [voice, setVoice] = useState("");
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [musicIds, setMusicIds] = useState<string[]>([]);
  const [musicBusy, setMusicBusy] = useState(false);
  const [art, setArt] = useState("");
  const [caption, setCaption] = useState("");
  const [name, setName] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<FrequencyId>(FREQUENCIES[0].id);
  const [time, setTime] = useState("18:00");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canContinue = [
    formats.length > 0 && niche.trim().length >= 3,
    !!voice,
    !musicBusy,
    !!art,
    !!caption,
    name.trim().length > 0,
  ][step];

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const preview = (id: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (previewing === id) {
      setPreviewing(null);
      return;
    }
    const v = VOICES.find((x) => x.id === id)!;
    const u = new SpeechSynthesisUtterance(`Hi, I'm ${v.name}. I will narrate your faceless videos.`);
    u.lang = language;
    u.pitch = v.pitch;
    u.rate = v.rate;
    u.onend = () => setPreviewing(null);
    setPreviewing(id);
    window.speechSynthesis.speak(u);
  };

  const next = () => {
    if (!canContinue) return;
    if (step === 0 && !name) setName(niche.split(/\s+/).slice(0, 3).join(" ").toLowerCase());
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    void save();
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    let created: SeriesDto;
    try {
      created = await api<SeriesDto>("/api/series/", {
        method: "POST",
        body: {
          name: name.trim(),
          formats,
          niche: niche.trim(),
          language,
          voice,
          musicTrackIds: musicIds,
          artStyle: art,
          captionStyle: caption,
          platforms,
          frequency,
          postTime: time,
        },
      });
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Could not create the series. Please try again.");
      setSaving(false);
      return;
    }
    // The first video goes straight to the queue (1 credit). Without credits the series still exists.
    await api(`/api/series/${created.id}/videos/`, { method: "POST" }).catch(() => undefined);
    await refreshDashboard();
    router.push(`/dashboard/series/${created.id}/`);
  };

  return (
    <DashboardShell crumbs={[{ label: "Series", href: "/dashboard/series/" }, { label: "Create New Series" }]}>
      <div className="mx-auto max-w-2xl py-2 md:py-4">
        <div className="mb-8 flex gap-2">
          {Array.from({ length: STEPS.length + 1 }).map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{STEPS[step]}</h1>
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>

        {step === 0 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Select one or more formats and enter your niche for the video</p>
            <div className="space-y-3">
              <p className={label}>Formats</p>
              <div className="max-h-72 overflow-y-auto rounded-lg border">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggle(formats, setFormats, f.id)}
                    className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    <Radio on={formats.includes(f.id)} />
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
                className={`${field} min-h-[120px]`}
                placeholder="Be as detailed as you want. Tell us exactly what kind of content you want to create. For example: 'Video about the most mysterious unsolved cases in true crime history'"
                value={niche}
                onChange={(e) => setNiche(e.target.value)} onBlur={(e) => setNiche(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Choose the language and the narrator of your videos</p>
            <div className="space-y-3">
              <label htmlFor="lang" className={label}>
                Language
              </label>
              <select id="lang" className={`${field} h-10`} value={language} onChange={(e) => setLanguage(e.target.value)} onBlur={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <p className={label}>Voice Style</p>
              <div className="max-h-80 overflow-y-auto rounded-lg border px-4">
                {VOICES.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 border-b py-4 last:border-0">
                    <button type="button" className="flex flex-1 items-start gap-3 text-left" onClick={() => setVoice(v.id)}>
                      <Radio on={voice === v.id} />
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
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Add background music to your video</p>
            <MusicPicker selected={musicIds} onChange={setMusicIds} onBusyChange={setMusicBusy} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Choose the visual style for your video</p>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {ART_STYLES.map((a) => (
                <button key={a.id} type="button" onClick={() => setArt(a.id)} className="w-40 shrink-0 text-left">
                  <span className={`relative block aspect-[9/16] overflow-hidden rounded-lg ring-offset-2 ${art === a.id ? "ring-2 ring-primary" : ""}`}>
                    <Scene variant={a.variant} className="absolute inset-0" />
                    {art === a.id && (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <Check className="h-4 w-4 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="mt-2 block text-sm font-medium">{a.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Choose how captions will appear in your video</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {CAPTION_STYLES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCaption(c.id)}
                  className={`relative rounded-lg border-2 p-4 text-left transition-colors ${caption === c.id ? "border-primary" : "border-border hover:border-muted-foreground/40"}`}
                >
                  <CaptionSample id={c.id} />
                  <span className="mt-3 block text-sm font-medium">{c.name}</span>
                  {caption === c.id && (
                    <span className="absolute right-6 top-6 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Name your series and choose where and how often it posts</p>
            <div className="space-y-3">
              <label htmlFor="name" className={label}>
                Series name
              </label>
              <input id="name" className={`${field} h-10`} value={name} onChange={(e) => setName(e.target.value)} onBlur={(e) => setName(e.target.value)} placeholder="e.g. history" />
            </div>
            <div className="space-y-3">
              <p className={label}>Post to</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {PLATFORMS.map((p) => {
                  const Icon = PLATFORM_ICON[p.id as keyof typeof PLATFORM_ICON];
                  const handle = connected(p.id);
                  const on = platforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(platforms, setPlatforms, p.id)}
                      className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left ${on ? "border-primary" : "border-border"}`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{handle ?? "Not connected"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {platforms.some((p) => !connected(p)) && (
                <p className="text-xs text-muted-foreground">
                  Videos are kept in your library until you connect the account in{" "}
                  <Link href="/dashboard/settings/" className="underline">
                    Settings
                  </Link>
                  .
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <label htmlFor="freq" className={label}>
                  Posting frequency
                </label>
                <select
                  id="freq"
                  className={`${field} h-10`}
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as FrequencyId)}
                  onBlur={(e) => setFrequency(e.target.value as FrequencyId)}
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
                <input id="time" type="time" className={`${field} h-10`} value={time} onChange={(e) => setTime(e.target.value)} onBlur={(e) => setTime(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {saveError && (
          <p role="alert" className="mt-6 text-sm text-destructive">
            {saveError}
          </p>
        )}
        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <button type="button" className={buttonClass("outline")} onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <span />
          )}
          <button type="button" className={buttonClass("primary")} disabled={!canContinue || saving} onClick={next}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {step === STEPS.length - 1 ? "Create Series" : "Continue"}
            {step < STEPS.length - 1 && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}
