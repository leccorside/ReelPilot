"use client";

// Browser-side store for the dashboard data that has no API yet (Passo 3 replaces it):
// series, videos, credits, plan and connected social accounts live in localStorage.
// Accounts and sign-in are real since Passo 2 (Auth.js + PostgreSQL).

import { useEffect, useState } from "react";

export type Series = {
  id: string;
  name: string;
  type: "Voiceover";
  formats: string[];
  niche: string;
  language: string;
  voice: string;
  musicUrls: string[];
  musicFiles: string[];
  artStyle: string;
  captionStyle: string;
  platforms: string[];
  frequency: string;
  postTime: string;
  status: "active" | "paused";
  createdAt: number;
};

export type Video = {
  id: string;
  seriesId: string;
  title: string;
  status: "generating" | "ready" | "published";
  createdAt: number;
  hue: number;
};

export type Plan = "free" | "starter" | "growth" | "pro";

export type Db = {
  series: Series[];
  videos: Video[];
  credits: number;
  creditsTotal: number;
  plan: Plan;
  connected: Record<string, string | null>;
  settings: { emailNotifications: boolean; autoPublish: boolean; timezone: string };
};

const KEY = "reelpilot-db-v1";

const empty = (): Db => ({
  series: [],
  videos: [],
  credits: 60,
  creditsTotal: 60,
  plan: "free",
  connected: { tiktok: null, instagram: null, youtube: null },
  settings: { emailNotifications: true, autoPublish: true, timezone: "UTC" },
});

export function loadDb(): Db {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

const listeners = new Set<() => void>();

export function saveDb(db: Db) {
  window.localStorage.setItem(KEY, JSON.stringify(db));
  listeners.forEach((l) => l());
}

export function updateDb(fn: (db: Db) => Db | void) {
  const db = loadDb();
  const next = fn(db) || db;
  saveDb(next);
  return next;
}

export function useDb(): Db | null {
  const [db, setDb] = useState<Db | null>(null);
  useEffect(() => {
    const refresh = () => setDb(loadDb());
    refresh();
    listeners.add(refresh);
    window.addEventListener("storage", refresh);
    return () => {
      listeners.delete(refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return db;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Clears the dashboard data kept in this browser (used when the account is deleted). */
export function resetDb() {
  window.localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

/** Starts generating the next video of a series; it becomes ready a few seconds later. */
export function generateVideo(seriesId: string): boolean {
  let ok = false;
  const id = uid();
  updateDb((db) => {
    const s = db.series.find((x) => x.id === seriesId);
    if (!s || db.credits < 1) return;
    const count = db.videos.filter((v) => v.seriesId === seriesId).length;
    db.credits -= 1;
    db.videos.unshift({
      id,
      seriesId,
      title: `${s.name} #${count + 1}`,
      status: "generating",
      createdAt: Date.now(),
      hue: Math.floor(Math.random() * 360),
    });
    ok = true;
  });
  if (ok) {
    window.setTimeout(() => {
      updateDb((db) => {
        const v = db.videos.find((x) => x.id === id);
        const s = db.series.find((x) => x.id === seriesId);
        if (!v) return;
        const canPost = !!s && s.platforms.some((p) => db.connected[p]) && db.settings.autoPublish;
        v.status = canPost ? "published" : "ready";
      });
    }, 6000);
  }
  return ok;
}

export const PLANS: { id: Plan; name: string; price: number; credits: number; perks: string[] }[] = [
  { id: "starter", name: "Starter", price: 19, credits: 30, perks: ["30 videos per month", "1 series", "Auto-posting to 1 platform", "All art styles"] },
  { id: "growth", name: "Growth", price: 39, credits: 90, perks: ["90 videos per month", "3 series", "Auto-posting to all platforms", "Custom background music"] },
  { id: "pro", name: "Pro", price: 69, credits: 200, perks: ["200 videos per month", "Unlimited series", "Priority rendering", "Premium voices"] },
];
