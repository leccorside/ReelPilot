// Development seed: recreates a demo account with series, videos, credits and a connected channel.
// Idempotent (deletes the demo user first; everything else goes with it by cascade).
//   .\scripts\dc.ps1 seed

import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { encryptSecret } from "@/server/crypto";
import { createDb } from "@/server/db";
import { getCreditBalance, SIGNUP_BONUS_CREDITS } from "@/server/db/credits";
import * as s from "@/server/db/schema";

const DEMO_EMAIL = "creator@example.com";

async function main() {
  const e = env();
  if (e.NODE_ENV === "production") throw new Error("o seed é só para desenvolvimento");

  const { db, client } = createDb(e.DATABASE_URL, { max: 1 });
  try {
    await db.transaction(async (tx) => {
      await tx.delete(s.users).where(eq(s.users.email, DEMO_EMAIL));

      const [user] = await tx
        .insert(s.users)
        .values({ name: "Demo Creator", email: DEMO_EMAIL, emailVerified: new Date(), timezone: "America/Sao_Paulo" })
        .returning();

      await tx.insert(s.creditLedger).values({ userId: user.id, delta: SIGNUP_BONUS_CREDITS, reason: "signup_bonus" });

      const [track] = await tx
        .insert(s.musicTracks)
        .values({
          userId: user.id,
          source: "url",
          name: "Calm piano loop",
          storageKey: `users/${user.id}/music/calm-piano.mp3`,
          sourceUrl: "https://example.com/calm-piano.mp3",
          mimeType: "audio/mpeg",
          sizeBytes: 2_400_000,
          durationMs: 92_000,
        })
        .returning();

      const [mysteries, facts] = await tx
        .insert(s.series)
        .values([
          {
            userId: user.id,
            name: "Unsolved Mysteries",
            formats: ["storytelling"],
            niche: "Unsolved mysteries and true crime cases",
            language: "en",
            voice: "marcus",
            artStyle: "realism",
            captionStyle: "bold",
            platforms: ["youtube"],
            frequency: "daily",
            postTime: "18:00",
            timezone: "America/Sao_Paulo",
          },
          {
            userId: user.id,
            name: "Fatos Curiosos",
            formats: ["facts", "top5"],
            niche: "Curiosidades sobre o corpo humano",
            language: "pt",
            voice: "nova",
            artStyle: "painting",
            captionStyle: "red",
            platforms: [],
            frequency: "three_per_week",
            postTime: "12:30",
            timezone: "America/Sao_Paulo",
            status: "paused",
          },
        ])
        .returning();

      await tx.insert(s.seriesMusicTracks).values({ seriesId: mysteries.id, musicTrackId: track.id });

      const [published, ready, failed] = await tx
        .insert(s.videos)
        .values([
          {
            seriesId: mysteries.id,
            userId: user.id,
            title: "The Lighthouse Keepers Who Vanished",
            status: "published",
            script: {
              title: "The Lighthouse Keepers Who Vanished",
              hook: "Three men disappeared from a locked island in 1900.",
              scenes: [
                { narration: "December 1900. A supply ship reaches the Flannan Isles.", visual: "Stormy sea, lonely lighthouse" },
                { narration: "The door is closed. The clocks have stopped.", visual: "Empty kitchen, overturned chair" },
              ],
              caption: "Nobody ever found them. #mystery",
              hashtags: ["mystery", "history"],
            },
            durationMs: 41_000,
            publishedAt: new Date(),
            publishedUrls: { youtube: "https://youtube.com/shorts/demo" },
          },
          { seriesId: mysteries.id, userId: user.id, title: "Unsolved Mysteries #2", status: "ready", durationMs: 38_500 },
          { seriesId: facts.id, userId: user.id, title: "Fatos Curiosos #1", status: "failed", error: "ComfyUI sem memória de vídeo" },
        ])
        .returning();

      const now = Date.now();
      await tx.insert(s.videoSteps).values(
        (["script", "voice", "images", "render", "publish"] as const).map((step, i) => ({
          videoId: published.id,
          step,
          status: "succeeded" as const,
          attempts: 1,
          startedAt: new Date(now - (5 - i) * 60_000),
          finishedAt: new Date(now - (4 - i) * 60_000),
          durationMs: 60_000,
          costMicroUsd: step === "script" ? 4_200 : 0,
        })),
      );

      await tx.insert(s.creditLedger).values([
        { userId: user.id, delta: -1, reason: "video_debit", videoId: published.id },
        { userId: user.id, delta: -1, reason: "video_debit", videoId: ready.id },
        { userId: user.id, delta: -1, reason: "video_debit", videoId: failed.id },
        { userId: user.id, delta: 1, reason: "video_refund", videoId: failed.id, note: "geração falhou" },
      ]);

      await tx.insert(s.socialConnections).values({
        userId: user.id,
        platform: "youtube",
        externalAccountId: "UC-demo-channel",
        username: "@democreator",
        accessTokenEnc: encryptSecret("demo-access-token", e.ENCRYPTION_KEY),
        refreshTokenEnc: encryptSecret("demo-refresh-token", e.ENCRYPTION_KEY),
        tokenExpiresAt: new Date(now + 3_600_000),
        scopes: ["https://www.googleapis.com/auth/youtube.upload"],
      });

      const balance = await getCreditBalance(tx, user.id);
      console.log(`[seed] usuário ${DEMO_EMAIL} (id ${user.id}): 2 séries, 3 vídeos, 1 música, 1 canal; saldo ${balance} créditos`);
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("[seed] falhou:", error instanceof Error ? error.message : error);
  process.exit(1);
});
