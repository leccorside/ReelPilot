"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { IN_PROGRESS, type MeDto, type MusicTrackDto, type SeriesDto, type VideoDto } from "./api-types";

// Browser side of the dashboard API: a fetch wrapper with readable errors and SWR hooks.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Calls the API and returns the JSON answer (or null for 204). Throws ApiError with the server's message. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (res.status === 401) {
    // Session ended (expired, signed out elsewhere, account deleted): go back to the login.
    window.location.assign(`/login/?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
    throw new ApiError("Not signed in", 401);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? "Something went wrong. Please try again.", res.status);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

const fetcher = <T>(path: string) => api<T>(path);

export const keys = {
  me: "/api/me/",
  series: "/api/series/",
  seriesOne: (id: string) => `/api/series/${id}/`,
  videos: (seriesId?: string) => (seriesId ? `/api/videos/?seriesId=${seriesId}` : "/api/videos/"),
  music: "/api/music/",
};

/** The user's music library. Playback links expire after 30 minutes, so the list refreshes every 20. */
export function useMusic() {
  return useSWR<MusicTrackDto[]>(keys.music, fetcher, { refreshInterval: 20 * 60 * 1000 });
}

/** Uploads one audio file as the raw request body (the server checks the content). */
export async function uploadMusicFile(file: File): Promise<MusicTrackDto> {
  const res = await fetch(keys.music, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
    body: file,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? "Upload failed. Please try again.", res.status);
  }
  return (await res.json()) as MusicTrackDto;
}

export function useMe() {
  return useSWR<MeDto>(keys.me, fetcher);
}

export function useSeriesList() {
  return useSWR<SeriesDto[]>(keys.series, fetcher);
}

export function useSeries(id: string | undefined) {
  return useSWR<SeriesDto>(id ? keys.seriesOne(id) : null, fetcher, { shouldRetryOnError: false });
}

/** Videos refresh every 5 seconds while any of them is still being made. */
export function useVideos(seriesId?: string) {
  return useSWR<VideoDto[]>(keys.videos(seriesId), fetcher, {
    refreshInterval: (data) => (data?.some((v) => IN_PROGRESS.includes(v.status)) ? 5000 : 0),
  });
}

/** Refreshes everything the dashboard shows (after creating/deleting things that move credits). */
export function refreshDashboard() {
  return globalMutate((key) => typeof key === "string" && (key.startsWith("/api/me") || key.startsWith("/api/series") || key.startsWith("/api/videos")));
}

/** Stable pseudo-random hue for a video id (placeholder artwork until real thumbnails exist). */
export function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}
