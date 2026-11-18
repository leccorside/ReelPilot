// Choices offered by the series wizard, as seen in the original's screen recordings
// (formats, voices, art styles and caption styles). Items marked "estimated" were not visible
// in the recordings and are reasonable additions.

export const FORMATS = [
  { id: "storytelling", name: "Storytelling", desc: "Classic storytelling format" },
  { id: "top5", name: "Top 5 Lists", desc: "Engaging countdown videos highlighting the best in any category" },
  { id: "howto", name: "How To Guides", desc: "Step-by-step tutorials and educational content" },
  { id: "facts", name: "Fun Facts", desc: "Surprising facts packed into a short video" }, // estimated
  { id: "quiz", name: "Quiz", desc: "Ask questions and reveal the answers" }, // estimated
];

export const LANGUAGES = [
  { id: "en", name: "English", flag: "🇬🇧" },
  { id: "es", name: "Spanish", flag: "🇪🇸" },
  { id: "pt", name: "Portuguese", flag: "🇧🇷" },
  { id: "fr", name: "French", flag: "🇫🇷" },
  { id: "it", name: "Italian", flag: "🇮🇹" },
  { id: "hi", name: "Hindi", flag: "🇮🇳" },
];

/** Narrators of the wizard. The Kokoro voice and pace behind each one, per language, are in voices.ts. */
export const VOICES = [
  { id: "adam", name: "Adam", gender: "Male", desc: "The well known voice of tiktok and instagram." },
  { id: "alex", name: "Alex", gender: "Male", desc: "An upbeat and pleasant male voice. Great for Youtube, shorts and social media." },
  { id: "bella", name: "Bella", gender: "Female", desc: "A soft, warm narrator for calm stories." },
  { id: "nova", name: "Nova", gender: "Female", desc: "Bright and energetic, made for fast facts." },
  { id: "marcus", name: "Marcus", gender: "Male", desc: "Deep and dramatic, perfect for scary stories." },
];

/**
 * Art styles. The ids are stored in the series, so they stay; names and image prompts never use a
 * trademark (Passo 8 renamed "Lego", "Disney", "Ghibli" and "Ghibsky"). `prompt` is added to every
 * scene's description for the image model (English, like the descriptions).
 */
export const ART_STYLES = [
  { id: "realism", name: "Realism", variant: 2, prompt: "photorealistic photograph, natural light, 35mm lens, sharp focus, rich detail" },
  { id: "polaroid", name: "Polaroid", variant: 1, prompt: "vintage instant film photograph, faded warm colors, soft vignette, light film grain" },
  { id: "lego", name: "Toy Bricks", variant: 4, prompt: "miniature diorama built entirely from colorful plastic toy construction bricks, glossy plastic, tilt-shift" },
  { id: "disney", name: "3D Animation", variant: 5, prompt: "3D animated feature film still, expressive stylized characters, soft cinematic lighting, vibrant colors" },
  { id: "ghibsky", name: "Dreamy Skies", variant: 3, prompt: "hand-painted anime background art, towering cumulus clouds, bright blue sky, lush green scenery" },
  { id: "anime", name: "Anime", variant: 0, prompt: "anime illustration, clean line art, cel shading, vivid colors" },
  { id: "painting", name: "Painting", variant: 6, prompt: "oil painting on canvas, visible brush strokes, rich textures, dramatic light" },
  { id: "ghibli", name: "Fantasy Watercolor", variant: 7, prompt: "whimsical hand-drawn watercolor animation style, soft pastel colors, cozy fantasy atmosphere" },
];

export const CAPTION_STYLES = [
  { id: "bold", name: "Bold Stroke" },
  { id: "red", name: "Red Highlight" },
  { id: "sleek", name: "Sleek" },
];

export const PLATFORMS = [
  { id: "tiktok", name: "TikTok" },
  { id: "instagram", name: "Instagram" },
  { id: "youtube", name: "YouTube" },
];

/** Ids match the posting_frequency enum in the database. */
export const FREQUENCIES = [
  { id: "daily", name: "1 video per day" },
  { id: "twice_daily", name: "2 videos per day" },
  { id: "three_per_week", name: "3 videos per week" },
  { id: "weekly", name: "1 video per week" },
] as const;

export type FrequencyId = (typeof FREQUENCIES)[number]["id"];

/** Fallback for browsers without Intl.supportedValuesOf. */
export const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "America/Sao_Paulo", "Europe/London", "Europe/Prague", "Asia/Kolkata", "Asia/Tokyo"];

/**
 * Every IANA time zone the browser knows (about 420; the API accepts any valid one), UTC first and
 * the current value always present. The short list left people in Lisbon or Sydney without their
 * zone (break-ui on Settings #9).
 */
export function timezoneOptions(current: string): string[] {
  let all: string[];
  try {
    all = Intl.supportedValuesOf("timeZone");
  } catch {
    all = TIMEZONES;
  }
  return ["UTC", ...[...new Set([...all, current])].filter((z) => z !== "UTC").sort()];
}

/** The browser's own time zone (null when it can't tell). */
export function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Name of an option by id (falls back to the id itself). */
export function optionName(list: readonly { id: string; name: string }[], id: string): string {
  return list.find((x) => x.id === id)?.name ?? id;
}
