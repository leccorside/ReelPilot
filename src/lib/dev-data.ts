"use client";

import { useEffect, useState } from "react";
import { cleanFileName } from "@/server/audio-file"; // pure function, safe in the browser
import type { MeDto, MusicTrackDto, SeriesDto } from "./api-types";

// DEVELOPMENT ONLY (break-ui): realistic worst-case datasets swapped in at the data boundary
// (the SWR hooks in api-client.ts) with ?data=worst|empty|one|huge. "Demo" = the real API.
// In production builds useDevDataset() always returns null, so nothing here is ever used.

export const DEV_DATASETS = ["worst", "empty", "one", "huge"] as const;
export type DevDataset = (typeof DEV_DATASETS)[number];

const IS_DEV = process.env.NODE_ENV !== "production";

function readDataset(): DevDataset | null {
  const v = new URLSearchParams(window.location.search).get("data");
  return (DEV_DATASETS as readonly string[]).includes(v ?? "") ? (v as DevDataset) : null;
}

/** The dataset chosen in the URL (read after mount, so server and first client render match). */
export function useDevDataset(): DevDataset | null {
  const [dataset, setDataset] = useState<DevDataset | null>(null);
  useEffect(() => {
    if (!IS_DEV) return;
    const sync = () => setDataset(readDataset());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return IS_DEV ? dataset : null;
}

/**
 * Reloads the page with the new dataset. A reload (instead of swapping in place) keeps the test
 * honest: forms that copy their data once on mount (like the series editor) start from the new
 * fixture exactly as they would from real data, without changing the component under test.
 */
export function setDevDataset(dataset: DevDataset | null) {
  const url = new URL(window.location.href);
  if (dataset) url.searchParams.set("data", dataset);
  else url.searchParams.delete("data");
  window.location.assign(url);
}

// ---------------------------------------------------------------------------------------------
// Fixtures. Every value is something a real user could produce, or the longest the API accepts.
// ---------------------------------------------------------------------------------------------

const MB = 1024 * 1024;
const at = "2026-11-11T12:00:00.000Z";
const track = (n: number, name: string, sizeBytes: number, source: "upload" | "url" = "upload"): MusicTrackDto => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  name,
  source,
  sourceUrl: source === "url" ? "https://cdn.example.com/audio/2026/11/" + name : null,
  sizeBytes,
  mimeType: name.endsWith(".wav") ? "audio/wav" : "audio/mpeg",
  createdAt: at,
  url: "/api/media/dev-fixture.mp3",
});

/** Worst case: the first rows of the library each fail differently. */
const WORST_TRACKS: MusicTrackDto[] = [
  // A YouTube "no copyright" download name (123 chars) exactly as the server stores it (120, extension kept).
  track(1, cleanFileName("Lo-fi Chill Beats to Study and Relax To (No Copyright) [Royalty Free Background Music for Videos] - Extended 1 Hour Mix.mp3", "x"), 10 * MB),
  // 110 characters with no spaces: export tools love underscores.
  track(2, "Ambient_Background_Music_For_YouTube_Shorts_Free_Download_HQ_320kbps_Remastered_Final_v2_FINAL_definitivo_2026.mp3", 9.97 * MB, "url"),
  track(3, "a.wav", 1),
  track(4, "🎵 Música de fundo – versão final (2).mp3", 1023),
  track(5, "موسيقى هادئة للخلفية.mp3", 3.4 * MB),
  track(6, "Nhạc nền nhẹ nhàng – bản phối lại.mp3", 2.1 * MB),
  track(7, "<b>beat</b> & chill &amp; more.wav", 512 * 1024),
  track(8, "Track (1).wav", 4.5 * MB),
];

const HUGE_TRACKS: MusicTrackDto[] = Array.from({ length: 50 }, (_, i) =>
  track(100 + i, `Background loop ${String(i + 1).padStart(2, "0")} – ${["calm", "upbeat", "dark", "cinematic", "lo-fi"][i % 5]} mood.mp3`, ((i % 9) + 1) * MB),
);

const baseSeries = (id: string): SeriesDto => ({
  id,
  name: "Bedtime stories",
  formats: ["storytelling"],
  niche: "Calm bedtime stories for kids",
  language: "en",
  voice: "bella",
  artStyle: "painting",
  captionStyle: "sleek",
  platforms: [],
  frequency: "daily",
  postTime: "18:00",
  timezone: "UTC",
  status: "active",
  musicTrackIds: [],
  createdAt: at,
  videoCount: 0,
  publishedCount: 0,
});

export function devSeries(dataset: DevDataset, id: string): SeriesDto {
  const s = baseSeries(id);
  switch (dataset) {
    case "worst":
      return {
        ...s,
        // 76 characters, close to the API's limit of 80.
        name: "Histórias Assustadoras da Vovó Aleksandra Wiśniewska-Kowalczyk – Temporada 2",
        // ~1000 characters: the API's limit, written the way people actually brief a series.
        niche:
          "Vídeos curtos contando lendas urbanas e casos reais pouco conhecidos do interior do Brasil, de Portugal e da Polônia, sempre com um gancho forte nos três primeiros segundos, " +
          "narração calma mas tensa, sem violência explícita e sem sangue (o canal é para maiores de 13 anos), citando a cidade e o ano de cada história quando houver registro, e terminando " +
          "com uma pergunta para o público comentar. Evitar temas políticos, religiosos ou que já viralizaram muito no último mês. Público principal: mulheres de 25 a 44 anos que assistem " +
          "antes de dormir. Referências de tom: podcasts de true crime, contos de Edgar Allan Poe, causos de avó contados na varanda. Usar sempre o nome real dos lugares e nunca o nome " +
          "completo de pessoas vivas. Quando a história tiver mais de uma versão, contar a mais antiga e mencionar que existem outras. Proibido inventar datas, números ou fontes que não existam. " +
          "Se a história envolver crianças, deixar claro logo no início que ela teve um final feliz.",
        formats: ["storytelling", "top5", "howto", "facts", "quiz"],
        language: "hi",
        voice: "marcus",
        platforms: ["tiktok", "instagram", "youtube"],
        frequency: "three_per_week",
        postTime: "23:59",
        // A valid IANA zone that is not in the dashboard's short list.
        timezone: "America/Argentina/ComodRivadavia",
        musicTrackIds: WORST_TRACKS.slice(0, 3).map((t) => t.id),
      };
    case "empty":
      return { ...s, name: "J", niche: "Cat", formats: ["quiz"], musicTrackIds: [] };
    case "one":
      return { ...s, platforms: ["youtube"], musicTrackIds: [track(1, "piano.mp3", 2 * MB).id] };
    case "huge":
      // The API's maximum of 10 selected tracks, out of a full library of 50.
      return { ...s, musicTrackIds: HUGE_TRACKS.slice(0, 10).map((t) => t.id) };
  }
}

export function devMusic(dataset: DevDataset): MusicTrackDto[] {
  switch (dataset) {
    case "worst":
      return WORST_TRACKS;
    case "empty":
      return [];
    case "one":
      return [track(1, "piano.mp3", 2 * MB)];
    case "huge":
      return HUGE_TRACKS;
  }
}

export function devMe(dataset: DevDataset): MeDto {
  const me: MeDto = {
    user: { id: "dev-user", name: "Jo", email: "jo@example.com", image: null, timezone: "UTC", emailNotifications: true, autoPublish: true },
    plan: { id: "free", name: "Free", monthlyCredits: 60 },
    credits: { balance: 60, allowance: 60 },
    connections: [],
  };
  if (dataset === "worst") {
    return {
      ...me,
      user: {
        ...me.user,
        name: "Aleksandra Wiśniewska-Kowalczyk",
        email: "bartholomew.fitzgerald@northwind-industries-holdings.example.com",
        timezone: "America/Argentina/ComodRivadavia",
      },
      credits: { balance: 1, allowance: 60 },
      connections: [
        // YouTube shows the channel title (up to 100 characters).
        { id: "c1", platform: "youtube", username: "Aleksandra Wiśniewska-Kowalczyk – Histórias, Mistérios e Lendas Urbanas do Interior", status: "active" },
        { id: "c2", platform: "tiktok", username: "@aleksandra.wisniewska.k", status: "active" },
        // An expired token must not count as connected.
        { id: "c3", platform: "instagram", username: "@bartholomew.fitzgerald.official", status: "expired" },
      ],
    };
  }
  if (dataset === "one") return { ...me, connections: [{ id: "c1", platform: "youtube", username: "@jo", status: "active" }] };
  return me;
}
