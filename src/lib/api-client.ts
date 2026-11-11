"use client";

import useSWR, { mutate as globalMutate, type SWRResponse } from "swr";
import { IN_PROGRESS, type MeDto, type MusicTrackDto, type SeriesDto, type VideoDto } from "./api-types";

// DEVELOPMENT ONLY (break-ui): the worst-case fixtures. In production builds this condition is the
// constant `true`, so webpack drops the require and none of the fixture data reaches the bundle.
const devData: typeof import("./dev-data") | null = process.env.NODE_ENV === "production" ? null : require("./dev-data");
/** Same hook on every render of a given build (null in production), so the rules of hooks hold. */
const useDevDataset: () => import("./dev-data").DevDataset | null = devData ? devData.useDevDataset : () => null;

/** DEVELOPMENT ONLY (break-ui): answers a hook with a fixture instead of the API. */
function devResponse<T>(real: SWRResponse<T>, data: T): SWRResponse<T> {
  return { ...real, data, error: undefined, isLoading: false, isValidating: false, mutate: (async () => data) as SWRResponse<T>["mutate"] };
}

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
  const dev = useDevDataset();
  const real = useSWR<MusicTrackDto[]>(dev ? null : keys.music, fetcher, { refreshInterval: 20 * 60 * 1000 });
  return dev ? devResponse(real, devData!.devMusic(dev)) : real;
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
  const dev = useDevDataset();
  const real = useSWR<MeDto>(dev ? null : keys.me, fetcher);
  return dev ? devResponse(real, devData!.devMe(dev)) : real;
}

export function useSeriesList() {
  const dev = useDevDataset();
  const real = useSWR<SeriesDto[]>(dev ? null : keys.series, fetcher);
  return dev ? devResponse(real, devData!.devSeriesList(dev)) : real;
}

export function useSeries(id: string | undefined) {
  const dev = useDevDataset();
  const real = useSWR<SeriesDto>(id && !dev ? keys.seriesOne(id) : null, fetcher, { shouldRetryOnError: false });
  return dev && id ? devResponse(real, devData!.devSeries(dev, id)) : real;
}

/** Videos refresh every 5 seconds while any of them is still being made. */
export function useVideos(seriesId?: string) {
  const dev = useDevDataset();
  const real = useSWR<VideoDto[]>(dev ? null : keys.videos(seriesId), fetcher, {
    refreshInterval: (data) => (data?.some((v) => IN_PROGRESS.includes(v.status)) ? 5000 : 0),
  });
  return dev ? devResponse(real, devData!.devVideos(dev)) : real;
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
