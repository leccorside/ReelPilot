"use client";

// A small browser-side store standing in for the original's backend:
// accounts, series, videos, credits and connected social accounts live in localStorage.

import { useEffect, useState } from "react";

export type User = { name: string; email: string; password?: string; provider: "email" | "google" };

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
  user: User | null;
  accounts: User[];
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
  user: null,
  accounts: [],
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

/** Signs in an existing account or registers a new one. Returns an error message or null. */
export function signIn(user: User, mode: "signup" | "signin" | "google"): string | null {
  let error: string | null = null;
  updateDb((db) => {
    const known = db.accounts.find((a) => a.email.toLowerCase() === user.email.toLowerCase());
    if (mode === "signup" && known && known.provider === "email") {
      error = "An account with this email already exists.";
      return;
    }
    if (mode === "signin") {
      if (!known) {
        error = "No account found with this email.";
        return;
      }
      if (known.password && known.password !== user.password) {
        error = "Incorrect password.";
        return;
      }
    }
    if (!known) db.accounts.push(user);
    db.user = known ? { ...known } : user;
  });
  return error;
}

export function signOut() {
  updateDb((db) => {
    db.user = null;
  });
}

export function signInWithGoogle() {
  signIn({ name: "Demo Creator", email: "creator@example.com", provider: "google" }, "google");
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
