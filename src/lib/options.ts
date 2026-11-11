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
  { id: "de", name: "German", flag: "🇩🇪" },
  { id: "it", name: "Italian", flag: "🇮🇹" },
  { id: "hi", name: "Hindi", flag: "🇮🇳" },
];

export const VOICES = [
  { id: "adam", name: "Adam", gender: "Male", desc: "The well known voice of tiktok and instagram.", pitch: 0.8, rate: 1 },
  { id: "alex", name: "Alex", gender: "Male", desc: "An upbeat and pleasant male voice. Great for Youtube, shorts and social media.", pitch: 1, rate: 1.1 },
  { id: "bella", name: "Bella", gender: "Female", desc: "A soft, warm narrator for calm stories.", pitch: 1.2, rate: 0.95 }, // estimated
  { id: "nova", name: "Nova", gender: "Female", desc: "Bright and energetic, made for fast facts.", pitch: 1.3, rate: 1.15 }, // estimated
  { id: "marcus", name: "Marcus", gender: "Male", desc: "Deep and dramatic, perfect for scary stories.", pitch: 0.6, rate: 0.9 }, // estimated
];

export const ART_STYLES = [
  { id: "realism", name: "Realism", variant: 2 },
  { id: "polaroid", name: "Polaroid", variant: 1 },
  { id: "lego", name: "Lego", variant: 4 },
  { id: "disney", name: "Disney", variant: 5 },
  { id: "ghibsky", name: "Ghibsky", variant: 3 },
  { id: "anime", name: "Anime", variant: 0 },
  { id: "painting", name: "Painting", variant: 6 },
  { id: "ghibli", name: "Ghibli", variant: 7 },
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

/** Time zones offered in the dashboard (any valid IANA zone is accepted by the API). */
export const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "America/Sao_Paulo", "Europe/London", "Europe/Prague", "Asia/Kolkata", "Asia/Tokyo"];

/** Name of an option by id (falls back to the id itself). */
export function optionName(list: readonly { id: string; name: string }[], id: string): string {
  return list.find((x) => x.id === id)?.name ?? id;
}
