import type { SeriesDto, SocialPlatform } from "./api-types";
import { SERIES_NAME_MAX, SERIES_NICHE_MAX, SERIES_NICHE_MIN } from "./limits";
import { FREQUENCIES, type FrequencyId } from "./options";

// The series form (creation wizard and edit page) without any UI, so the rules can be unit-tested.

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

export type Section = "formats" | "voice" | "art" | "caption" | "schedule";

/** What is still wrong in a section, in words the user can act on (null = fine). Same rules as the API. */
export function sectionProblem(section: Section, f: SeriesForm): string | null {
  switch (section) {
    case "formats": {
      if (f.formats.length === 0) return "Choose at least one format.";
      const n = f.niche.trim().length;
      if (n < SERIES_NICHE_MIN) return `Describe what the videos are about (at least ${SERIES_NICHE_MIN} characters).`;
      if (n > SERIES_NICHE_MAX) return `The description can have at most ${SERIES_NICHE_MAX.toLocaleString("en-US")} characters.`;
      return null;
    }
    case "voice":
      return f.voice ? null : "Choose a voice.";
    case "art":
      return f.artStyle ? null : "Choose an art style.";
    case "caption":
      return f.captionStyle ? null : "Choose a caption style.";
    case "schedule": {
      const n = f.name.trim().length;
      if (n === 0) return "Give your series a name.";
      if (n > SERIES_NAME_MAX) return `The series name can have at most ${SERIES_NAME_MAX} characters (now ${n}).`;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.postTime)) return "Choose a posting time.";
      return null;
    }
  }
}

export const sectionValid = {
  formats: (f: SeriesForm) => sectionProblem("formats", f) === null,
  voice: (f: SeriesForm) => sectionProblem("voice", f) === null,
  art: (f: SeriesForm) => sectionProblem("art", f) === null,
  caption: (f: SeriesForm) => sectionProblem("caption", f) === null,
  schedule: (f: SeriesForm) => sectionProblem("schedule", f) === null,
};

/** First problem of the whole form (edit page), or null. */
export function firstFormProblem(f: SeriesForm): string | null {
  for (const s of ["formats", "voice", "art", "caption", "schedule"] as const) {
    const p = sectionProblem(s, f);
    if (p) return p;
  }
  return null;
}

const SUGGESTED_NAME_MAX = 40;

/**
 * A short series name from the niche: the first words (up to 4, at most 40 characters), keeping
 * the user's capitalization, skipping pasted links, never cutting a word and never over the limit.
 */
export function suggestSeriesName(niche: string): string {
  const words = niche
    .split(/\s+/)
    .filter((w) => w && !/^(https?:\/\/|www\.)/i.test(w));
  let name = "";
  for (const w of words) {
    const next = name ? `${name} ${w}` : w;
    if (next.length > SUGGESTED_NAME_MAX) break;
    name = next;
    if (name.split(" ").length >= 4) break;
  }
  // A single very long first word: cut it rather than return nothing.
  if (!name && words[0]) name = Array.from(words[0]).slice(0, SUGGESTED_NAME_MAX).join("");
  return name.replace(/[\s,.;:!?–—-]+$/u, "").slice(0, SERIES_NAME_MAX);
}
