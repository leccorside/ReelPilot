"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { MusicPicker } from "@/components/dashboard/music-picker";
import {
  ArtStyleField,
  CaptionStyleField,
  emptySeriesForm,
  FormatsNicheFields,
  LanguageVoiceFields,
  ScheduleFields,
  sectionValid,
  type SeriesForm,
} from "@/components/dashboard/series-fields";
import { buttonClass } from "@/components/button";
import { api, ApiError, refreshDashboard, useMe } from "@/lib/api-client";
import type { SeriesDto } from "@/lib/api-types";

const STEPS = ["Choose Formats & Niche", "Language & Voice", "Background Music", "Art Style", "Caption Style", "Schedule & Publish"];
const HINTS = [
  "Select one or more formats and enter your niche for the video",
  "Choose the language and the narrator of your videos",
  "Add background music to your video",
  "Choose the visual style for your video",
  "Choose how captions will appear in your video",
  "Name your series and choose where and how often it posts",
];

export default function CreateSeriesPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SeriesForm>(emptySeriesForm);
  const [musicBusy, setMusicBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const set = (patch: Partial<SeriesForm>) => setForm((f) => ({ ...f, ...patch }));

  const canContinue = [
    sectionValid.formats(form),
    sectionValid.voice(form),
    !musicBusy,
    sectionValid.art(form),
    sectionValid.caption(form),
    sectionValid.schedule(form),
  ][step];

  const next = () => {
    if (!canContinue) return;
    if (step === 0 && !form.name) set({ name: form.niche.split(/\s+/).slice(0, 3).join(" ").toLowerCase() });
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
      // The time zone is left out: new series use the account's time zone (Settings).
      const { timezone: _tz, ...body } = form;
      created = await api<SeriesDto>("/api/series/", {
        method: "POST",
        body: { ...body, name: form.name.trim(), niche: form.niche.trim() },
      });
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Could not create the series. Please try again.");
      setSaving(false);
      return;
    }
    // The first video goes straight to the queue (1 credit). Without credits the series still exists.
    await api(`/api/series/${created.id}/videos/`, { method: "POST" }).catch(() => undefined);
    // Not awaited: the next page loads its own data; this only refreshes cached lists (credits, series).
    void refreshDashboard();
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

        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">{HINTS[step]}</p>
          {step === 0 && <FormatsNicheFields value={form} set={set} />}
          {step === 1 && <LanguageVoiceFields value={form} set={set} />}
          {step === 2 && <MusicPicker selected={form.musicTrackIds} onChange={(ids) => set({ musicTrackIds: ids })} onBusyChange={setMusicBusy} />}
          {step === 3 && <ArtStyleField value={form} set={set} />}
          {step === 4 && <CaptionStyleField value={form} set={set} />}
          {step === 5 && <ScheduleFields value={form} set={set} me={me} />}
        </div>

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
