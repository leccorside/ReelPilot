"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate as globalMutate, type SWRResponse } from "swr";
import useSWRInfinite from "swr/infinite";
import { IN_PROGRESS, type MeDto, type MusicTrackDto, type SeriesDto, VIDEO_PAGE_SIZE, type VideoDto, videoCursor } from "./api-types";

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

/** Revalidators of the mounted paged lists (see useVideos). */
const pagedLists = new Set<() => Promise<unknown>>();

export type VideoPages = {
  data: VideoDto[] | undefined;
  error: unknown;
  isLoading: boolean;
  /** More (older) videos exist beyond what is loaded. */
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
};

/**
 * The user's videos, newest first, in pages of 50 ("Load more" fetches the next one with the cursor
 * of the last video). Everything loaded refreshes every 5 seconds while a video is being made.
 */
export function useVideos(seriesId?: string): VideoPages {
  const dev = useDevDataset();
  const [devPages, setDevPages] = useState(1);
  const base = `/api/videos/?limit=${VIDEO_PAGE_SIZE}${seriesId ? `&seriesId=${seriesId}` : ""}`;
  const inf = useSWRInfinite<VideoDto[]>(
    (index, previous: VideoDto[] | null) => {
      if (dev) return null;
      if (previous && previous.length < VIDEO_PAGE_SIZE) return null; // the previous page was the last one
      return index === 0 || !previous ? base : `${base}&cursor=${encodeURIComponent(videoCursor(previous[previous.length - 1]))}`;
    },
    fetcher,
    { refreshInterval: (pages) => (pages?.some((page) => page.some((v) => IN_PROGRESS.includes(v.status))) ? 5000 : 0) },
  );

  // refreshDashboard() reaches paged lists through this registry: SWR's global mutate() with a key
  // filter does not revalidate useSWRInfinite caches.
  const { mutate: revalidatePages } = inf;
  useEffect(() => {
    const refresh = () => revalidatePages();
    pagedLists.add(refresh);
    return () => void pagedLists.delete(refresh);
  }, [revalidatePages]);

  if (dev) {
    // Development datasets: page through the fixture the same way.
    const all = devData!.devVideos(dev);
    const shown = all.slice(0, devPages * VIDEO_PAGE_SIZE);
    return { data: shown, error: undefined, isLoading: false, hasMore: shown.length < all.length, isLoadingMore: false, loadMore: () => setDevPages((n) => n + 1) };
  }

  const pages = inf.data;
  const last = pages?.[pages.length - 1];
  return {
    data: pages?.flat(),
    error: inf.error,
    isLoading: inf.isLoading,
    hasMore: !!last && last.length === VIDEO_PAGE_SIZE,
    isLoadingMore: inf.isValidating && !!pages && inf.size > pages.length,
    loadMore: () => void inf.setSize(inf.size + 1),
  };
}

/** Refreshes everything the dashboard shows (after creating/deleting things that move credits). */
export function refreshDashboard() {
  pagedLists.forEach((refresh) => void refresh());
  return globalMutate((key) => typeof key === "string" && (key.startsWith("/api/me") || key.startsWith("/api/series") || key.includes("/api/videos")));
}

/** Stable pseudo-random hue for a video id (placeholder artwork until real thumbnails exist). */
export function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}
