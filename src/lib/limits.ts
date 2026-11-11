// Limits shared by the API validation and the dashboard forms, so both always agree.

export const SERIES_NAME_MAX = 80;
/** 2, not 3: "F1", "AI" and "UX" are real channel topics (break-ui on the wizard). */
export const SERIES_NICHE_MIN = 2;
export const SERIES_NICHE_MAX = 1000;
/** A person's name (sign-up and Settings). */
export const ACCOUNT_NAME_MAX = 80;
/** Background tracks per series (one is picked per video). */
export const MAX_TRACKS_PER_SERIES = 10;
