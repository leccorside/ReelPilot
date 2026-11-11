"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardHeader } from "@/components/dashboard/ui";
import { MusicPicker } from "@/components/dashboard/music-picker";
import {
  ArtStyleField,
  CaptionStyleField,
  FormatsNicheFields,
  formFromSeries,
  LanguageVoiceFields,
  ScheduleFields,
  sectionValid,
  type SeriesForm,
} from "@/components/dashboard/series-fields";
import { buttonClass } from "@/components/button";
import { api, ApiError, refreshDashboard, useMe, useSeries } from "@/lib/api-client";
import type { SeriesDto } from "@/lib/api-types";

const LIST_FIELDS = ["formats", "platforms", "musicTrackIds"] as const;

/** Only the fields that changed (lists compared as sets), ready for PATCH /api/series/:id. */
function changedFields(original: SeriesForm, form: SeriesForm): Partial<SeriesForm> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(form) as (keyof SeriesForm)[]) {
    const a = original[key];
    const b = form[key];
    const same = (LIST_FIELDS as readonly string[]).includes(key)
      ? [...(a as string[])].sort().join("\n") === [...(b as string[])].sort().join("\n")
      : (typeof b === "string" ? b.trim() : b) === a;
    if (!same) patch[key] = typeof b === "string" ? b.trim() : b;
  }
  return patch as Partial<SeriesForm>;
}

export default function EditSeriesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: series, error, isLoading, mutate } = useSeries(id);
  const { data: me } = useMe();
  const [form, setForm] = useState<SeriesForm | null>(null);
  const [musicBusy, setMusicBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Start from the saved series once; later refreshes must not overwrite what the user is typing.
  useEffect(() => {
    if (series && !form) setForm(formFromSeries(series));
  }, [series, form]);

  const original = useMemo(() => (series ? formFromSeries(series) : null), [series]);
  const patch = form && original ? changedFields(original, form) : {};
  const dirty = Object.keys(patch).length > 0;
  const valid =
    !!form && sectionValid.formats(form) && sectionValid.voice(form) && sectionValid.art(form) && sectionValid.caption(form) && sectionValid.schedule(form);

  // Warn before leaving with unsaved changes (closing the tab, reloading).
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  const set = (p: Partial<SeriesForm>) => setForm((f) => (f ? { ...f, ...p } : f));

  const save = async () => {
    if (!dirty || !valid) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api<SeriesDto>(`/api/series/${id}/`, { method: "PATCH", body: patch });
      await mutate(updated, { revalidate: false });
      void refreshDashboard(); // not awaited: the detail page loads its own data
      router.push(`/dashboard/series/${id}/?saved=1`);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Could not save the changes. Please try again.");
      setSaving(false);
    }
  };

  const crumbs = [
    { label: "Series", href: "/dashboard/series/" },
    { label: series?.name ?? "Series", href: `/dashboard/series/${id}/` },
    { label: "Edit" },
  ];

  if (isLoading || (!error && !form))
    return (
      <DashboardShell crumbs={crumbs}>
        <Card className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Card>
      </DashboardShell>
    );

  if (error || !form)
    return (
      <DashboardShell crumbs={crumbs}>
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">
            {error instanceof ApiError && error.status === 404 ? "This series doesn't exist anymore." : "Could not load this series. Please reload the page."}
          </p>
          <Link href="/dashboard/series/" className={buttonClass("outline", "default", "mt-4")}>
            Back to series
          </Link>
        </Card>
      </DashboardShell>
    );

  const sections = [
    { title: "Formats & Niche", description: "What the videos are about", body: <FormatsNicheFields value={form} set={set} /> },
    { title: "Language & Voice", description: "Language and narrator of the videos", body: <LanguageVoiceFields value={form} set={set} /> },
    {
      title: "Background Music",
      description: "Selected tracks play in the background",
      body: <MusicPicker selected={form.musicTrackIds} onChange={(ids) => set({ musicTrackIds: ids })} onBusyChange={setMusicBusy} />,
    },
    { title: "Art Style", description: "Visual style of the images", body: <ArtStyleField value={form} set={set} /> },
    { title: "Caption Style", description: "How captions appear", body: <CaptionStyleField value={form} set={set} /> },
    { title: "Schedule & Publish", description: "Name, platforms and posting schedule", body: <ScheduleFields value={form} set={set} me={me} showTimezone /> },
  ];

  return (
    <DashboardShell crumbs={crumbs}>
      <div className="mx-auto max-w-3xl space-y-6 pb-24">
        <div>
          <h1 className="text-2xl font-semibold">Edit series</h1>
          <p className="mt-1 text-sm text-muted-foreground">Changes apply to the next videos of this series. Videos already made stay as they are.</p>
        </div>

        {sections.map((s) => (
          <Card key={s.title}>
            <CardHeader title={s.title} description={s.description} />
            <div className="space-y-6 px-6 pb-6">{s.body}</div>
          </Card>
        ))}
      </div>

      {/* Save bar always in reach on long pages. */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-3">
          {saveError && (
            <p role="alert" className="mr-auto text-sm text-destructive">
              {saveError}
            </p>
          )}
          {!saveError && !valid && <p className="mr-auto text-sm text-muted-foreground">Fill in every section to save.</p>}
          <Link href={`/dashboard/series/${id}/`} className={buttonClass("outline")}>
            Cancel
          </Link>
          <button type="button" className={buttonClass("primary")} disabled={!dirty || !valid || musicBusy || saving} onClick={save}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}
