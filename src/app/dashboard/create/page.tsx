"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { MusicPicker } from "@/components/dashboard/music-picker";
import { ArtStyleField, CaptionStyleField, FormatsNicheFields, LanguageVoiceFields, ScheduleFields } from "@/components/dashboard/series-fields";
import { buttonClass } from "@/components/button";
import { api, ApiError, refreshDashboard, useMe } from "@/lib/api-client";
import type { SeriesDto } from "@/lib/api-types";
import { emptySeriesForm, type Section, sectionProblem, type SeriesForm, suggestSeriesName } from "@/lib/series-form";

const STEPS = ["Choose Formats & Niche", "Language & Voice", "Background Music", "Art Style", "Caption Style", "Schedule & Publish"];
const HINTS = [
  "Select one or more formats and enter your niche for the video",
  "Choose the language and the narrator of your videos",
  "Add background music to your video",
  "Choose the visual style for your video",
  "Choose how captions will appear in your video",
  "Name your series and choose where and how often it posts",
];
/** Section checked by each step (the music step only waits for uploads). */
const STEP_SECTION: (Section | null)[] = ["formats", "voice", null, "art", "caption", "schedule"];

type Draft = { step: number; form: SeriesForm };

export default function CreateSeriesPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const userId = useSession().data?.user?.id;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SeriesForm>(emptySeriesForm);
  const [musicBusy, setMusicBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restored, setRestored] = useState<"pending" | "none" | "restored">("pending");
  const set = (patch: Partial<SeriesForm>) => setForm((f) => ({ ...f, ...patch }));

  // Unfinished wizards survive leaving the page and reloading (kept in this tab only, per account).
  const draftKey = userId ? `reelpilot:series-draft:${userId}` : null;
  const hasProgress = step > 0 || form.formats.length > 0 || form.niche.trim().length > 0;

  useEffect(() => {
    if (!draftKey || restored !== "pending") return;
    try {
      const draft = JSON.parse(sessionStorage.getItem(draftKey) ?? "null") as Draft | null;
      if (draft?.form) {
        setForm({ ...emptySeriesForm(), ...draft.form });
        setStep(Math.min(Math.max(0, Math.floor(draft.step) || 0), STEPS.length - 1));
        setRestored("restored");
        return;
      }
    } catch {
      // unreadable draft: start fresh
    }
    setRestored("none");
  }, [draftKey, restored]);

  useEffect(() => {
    if (!draftKey || restored === "pending" || saving) return;
    try {
      if (hasProgress) sessionStorage.setItem(draftKey, JSON.stringify({ step, form } satisfies Draft));
      else sessionStorage.removeItem(draftKey);
    } catch {
      // storage full or blocked: the wizard still works, only without the draft
    }
  }, [draftKey, restored, saving, hasProgress, step, form]);

  // Closing the tab or reloading with work in progress asks first (the draft covers in-app navigation).
  useEffect(() => {
    if (!hasProgress || saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasProgress, saving]);

  const startOver = () => {
    try {
      if (draftKey) sessionStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
    setForm(emptySeriesForm());
    setStep(0);
    setRestored("none");
  };

  const section = STEP_SECTION[step];
  const problem = section ? sectionProblem(section, form) : musicBusy ? "Wait for the music to finish uploading." : null;
  const canContinue = problem === null;
  const outOfCredits = me !== undefined && me.credits.balance < 1;

  const next = () => {
    if (!canContinue) return;
    if (step === 0 && !form.name) set({ name: suggestSeriesName(form.niche) });
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
    // The first video goes straight to the queue (1 credit). Without credits the series still
    // exists, and the series page says why it has no video yet.
    let first = "queued";
    try {
      await api(`/api/series/${created.id}/videos/`, { method: "POST" });
    } catch (e) {
      first = e instanceof ApiError && e.status === 402 ? "no-credits" : "failed";
    }
    try {
      if (draftKey) sessionStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
    // Not awaited: the next page loads its own data; this only refreshes cached lists (credits, series).
    void refreshDashboard();
    router.push(`/dashboard/series/${created.id}/${first === "queued" ? "" : `?first=${first}`}`);
  };

  return (
    <DashboardShell crumbs={[{ label: "Series", href: "/dashboard/series/" }, { label: "Create New Series" }]}>
      <div className="mx-auto max-w-2xl py-2 md:py-4">
        {/* One segment per step: full on the last one. */}
        <div className="mb-8 flex gap-2" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        {restored === "restored" && (
          <p role="status" className="mb-4 flex flex-wrap items-center gap-x-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            We kept the series you were creating.
            <button type="button" className="font-medium text-foreground underline" onClick={startOver}>
              Start over
            </button>
          </p>
        )}
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
          {step === 5 && outOfCredits && (
            <p role="note" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              You&apos;re out of credits. The series will be created, but its first video will only be made when you have credits again.
            </p>
          )}
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
          <button type="button" className={buttonClass("primary")} disabled={!canContinue || saving} aria-describedby={problem ? "step-problem" : undefined} onClick={next}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {step === STEPS.length - 1 ? "Create Series" : "Continue"}
            {step < STEPS.length - 1 && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
        {/* Why the button is disabled, so nobody is left guessing (break-ui on the wizard). */}
        {problem && (
          <p id="step-problem" role="status" className="mt-3 text-right text-sm text-muted-foreground">
            {problem}
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
