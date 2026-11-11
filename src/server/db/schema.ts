import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------------------------

export const seriesStatus = pgEnum("series_status", ["active", "paused"]);

/** How often a series posts. The wizard labels are mapped in src/lib/options.ts. */
export const postingFrequency = pgEnum("posting_frequency", ["daily", "twice_daily", "three_per_week", "weekly"]);

/** Video pipeline: queued → scripting → voicing → imaging → rendering → ready → publishing → published | failed. */
export const videoStatus = pgEnum("video_status", [
  "queued",
  "scripting",
  "voicing",
  "imaging",
  "rendering",
  "ready",
  "publishing",
  "published",
  "failed",
]);

export const videoStepName = pgEnum("video_step_name", ["script", "voice", "images", "render", "publish"]);
export const videoStepStatus = pgEnum("video_step_status", ["pending", "running", "succeeded", "failed"]);

export const creditReason = pgEnum("credit_reason", [
  "signup_bonus",
  "monthly_grant",
  "video_debit",
  "video_refund",
  "manual_adjustment",
]);

export const plan = pgEnum("plan", ["free", "starter", "growth", "pro"]);
export const subscriptionStatus = pgEnum("subscription_status", ["trialing", "active", "past_due", "canceled", "incomplete"]);

export const socialPlatform = pgEnum("social_platform", ["tiktok", "instagram", "youtube"]);
export const connectionStatus = pgEnum("connection_status", ["active", "expired", "revoked"]);

export const musicSource = pgEnum("music_source", ["upload", "url"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------------------------
// Auth.js (property names follow @auth/drizzle-adapter; database columns are snake_case)
// ---------------------------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").notNull().unique(),
    emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
    image: text("image"),
    /** argon2 hash; null for accounts that only sign in with Google. */
    passwordHash: text("password_hash"),
    /** Bumped by "sign out everywhere" and account changes; JWTs carrying an older value stop working. */
    sessionVersion: integer("session_version").notNull().default(0),
    timezone: text("timezone").notNull().default("UTC"),
    emailNotifications: boolean("email_notifications").notNull().default(true),
    autoPublish: boolean("auto_publish").notNull().default(true),
    ...timestamps,
  },
  // E-mails are stored lowercase, so "Ana@x.com" and "ana@x.com" cannot become two accounts.
  (t) => [check("users_email_lowercase", sql`${t.email} = lower(${t.email})`)],
);

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] }), index("accounts_user_id_idx").on(t.userId)],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------------------------------------------------------------------------------------------
// Series and music
// ---------------------------------------------------------------------------------------------

export const series = pgTable(
  "series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Format ids from src/lib/options.ts (storytelling, top5, howto...). */
    formats: text("formats").array().notNull(),
    niche: text("niche").notNull(),
    language: text("language").notNull(),
    voice: text("voice").notNull(),
    artStyle: text("art_style").notNull(),
    captionStyle: text("caption_style").notNull(),
    platforms: socialPlatform("platforms").array().notNull().default(sql`'{}'::social_platform[]`),
    frequency: postingFrequency("frequency").notNull(),
    /** Local posting time "HH:MM" in the series timezone. */
    postTime: text("post_time").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    status: seriesStatus("status").notNull().default("active"),
    /** Topics already used, so the script model does not repeat itself (Passo 6). */
    usedTopics: text("used_topics").array().notNull().default(sql`'{}'::text[]`),
    ...timestamps,
  },
  (t) => [
    index("series_user_id_idx").on(t.userId),
    check("series_formats_not_empty", sql`cardinality(${t.formats}) > 0`),
    check("series_post_time_format", sql`${t.postTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  ],
);

export const musicTracks = pgTable(
  "music_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: musicSource("source").notNull(),
    name: text("name").notNull(),
    /** Object key in the S3 bucket (uploads and imported URLs are both stored). */
    storageKey: text("storage_key").notNull(),
    /** Original address when imported from a URL. */
    sourceUrl: text("source_url"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    durationMs: integer("duration_ms"),
    ...timestamps,
  },
  (t) => [
    index("music_tracks_user_id_idx").on(t.userId),
    check("music_tracks_size_limit", sql`${t.sizeBytes} > 0 and ${t.sizeBytes} <= 10485760`),
  ],
);

export const seriesMusicTracks = pgTable(
  "series_music_tracks",
  {
    seriesId: uuid("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    musicTrackId: uuid("music_track_id")
      .notNull()
      .references(() => musicTracks.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.seriesId, t.musicTrackId] })],
);

// ---------------------------------------------------------------------------------------------
// Videos and pipeline steps
// ---------------------------------------------------------------------------------------------

/** Script produced in Passo 6, stored as JSON. */
export type VideoScript = {
  title: string;
  hook: string;
  scenes: { narration: string; visual: string }[];
  caption: string;
  hashtags: string[];
};

export const videos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    /** Owner (denormalized from the series) so every query can filter by user directly. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: videoStatus("status").notNull().default("queued"),
    script: jsonb("script").$type<VideoScript>(),
    /** S3 object keys (signed URLs are generated on demand, never stored). */
    audioKey: text("audio_key"),
    videoKey: text("video_key"),
    thumbnailKey: text("thumbnail_key"),
    durationMs: integer("duration_ms"),
    error: text("error"),
    /** When the scheduler wants it published (Passo 11). */
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Post links per platform after publishing, e.g. { youtube: "https://..." }. */
    publishedUrls: jsonb("published_urls").$type<Partial<Record<"tiktok" | "instagram" | "youtube", string>>>(),
    ...timestamps,
  },
  (t) => [
    index("videos_user_id_created_idx").on(t.userId, t.createdAt),
    index("videos_series_id_idx").on(t.seriesId),
    index("videos_status_idx").on(t.status),
  ],
);

export const videoSteps = pgTable(
  "video_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    step: videoStepName("step").notNull(),
    status: videoStepStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    /** Estimated cost in millionths of a dollar (Claude API; local AI steps are 0). */
    costMicroUsd: bigint("cost_micro_usd", { mode: "number" }).notNull().default(0),
    /** Step result (S3 keys, word timestamps...) so a retry can skip finished work. */
    output: jsonb("output").$type<Record<string, unknown>>(),
    error: text("error"),
    ...timestamps,
  },
  (t) => [uniqueIndex("video_steps_video_step_uq").on(t.videoId, t.step)],
);

// ---------------------------------------------------------------------------------------------
// Credits (the balance is always the sum of the ledger)
// ---------------------------------------------------------------------------------------------

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Positive adds credits, negative spends them. Never zero. */
    delta: integer("delta").notNull(),
    reason: creditReason("reason").notNull(),
    videoId: uuid("video_id").references(() => videos.id, { onDelete: "set null" }),
    /** Makes a grant idempotent, e.g. the Stripe invoice id of a monthly renewal. */
    idempotencyKey: text("idempotency_key").unique(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("credit_ledger_user_id_idx").on(t.userId),
    check("credit_ledger_delta_not_zero", sql`${t.delta} <> 0`),
    check(
      "credit_ledger_sign_matches_reason",
      sql`(${t.reason} = 'video_debit' and ${t.delta} < 0)
        or (${t.reason} in ('signup_bonus', 'monthly_grant', 'video_refund') and ${t.delta} > 0)
        or ${t.reason} = 'manual_adjustment'`,
    ),
    // A video is charged at most once and refunded at most once.
    uniqueIndex("credit_ledger_video_reason_uq")
      .on(t.videoId, t.reason)
      .where(sql`${t.videoId} is not null and ${t.reason} in ('video_debit', 'video_refund')`),
  ],
);

// ---------------------------------------------------------------------------------------------
// Billing and social accounts
// ---------------------------------------------------------------------------------------------

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: plan("plan").notNull(),
    status: subscriptionStatus("status").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("subscriptions_user_id_idx").on(t.userId),
    // At most one subscription per user that still counts (active, trialing or past due).
    uniqueIndex("subscriptions_one_current_per_user_uq")
      .on(t.userId)
      .where(sql`${t.status} in ('active', 'trialing', 'past_due')`),
  ],
);

export const socialConnections = pgTable(
  "social_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: socialPlatform("platform").notNull(),
    externalAccountId: text("external_account_id").notNull(),
    username: text("username").notNull(),
    /** AES-256-GCM ciphertext (src/server/crypto.ts). Plain tokens are never stored. */
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
    status: connectionStatus("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [uniqueIndex("social_connections_account_uq").on(t.userId, t.platform, t.externalAccountId)],
);
