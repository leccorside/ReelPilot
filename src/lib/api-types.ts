// JSON shapes returned by the API (dates are ISO strings). Shared by the server and the dashboard.

import type { FrequencyId } from "./options";
import type { PlanId } from "./plans";

export type SocialPlatform = "tiktok" | "instagram" | "youtube";

export type VideoStatus =
  | "queued"
  | "scripting"
  | "voicing"
  | "imaging"
  | "rendering"
  | "ready"
  | "publishing"
  | "published"
  | "failed";

/** Statuses in which the video is still being made. */
export const IN_PROGRESS: readonly VideoStatus[] = ["queued", "scripting", "voicing", "imaging", "rendering", "publishing"];

export type SeriesDto = {
  id: string;
  name: string;
  formats: string[];
  niche: string;
  language: string;
  voice: string;
  artStyle: string;
  captionStyle: string;
  platforms: SocialPlatform[];
  frequency: FrequencyId;
  postTime: string;
  timezone: string;
  status: "active" | "paused";
  createdAt: string;
  videoCount: number;
  publishedCount: number;
};

export type VideoDto = {
  id: string;
  seriesId: string;
  seriesName: string;
  title: string;
  status: VideoStatus;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
  publishedAt: string | null;
  publishedUrls: Partial<Record<SocialPlatform, string>> | null;
  /** True when the rendered MP4 exists (from Passo 9 on). */
  hasFile: boolean;
};

export type MeDto = {
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    timezone: string;
    emailNotifications: boolean;
    autoPublish: boolean;
  };
  plan: { id: PlanId; name: string; monthlyCredits: number };
  credits: { balance: number; allowance: number };
  connections: { id: string; platform: SocialPlatform; username: string; status: "active" | "expired" | "revoked" }[];
};
