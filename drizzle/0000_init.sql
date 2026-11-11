CREATE TYPE "public"."connection_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."credit_reason" AS ENUM('signup_bonus', 'monthly_grant', 'video_debit', 'video_refund', 'manual_adjustment');--> statement-breakpoint
CREATE TYPE "public"."music_source" AS ENUM('upload', 'url');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'starter', 'growth', 'pro');--> statement-breakpoint
CREATE TYPE "public"."posting_frequency" AS ENUM('daily', 'twice_daily', 'three_per_week', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."series_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('tiktok', 'instagram', 'youtube');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."video_status" AS ENUM('queued', 'scripting', 'voicing', 'imaging', 'rendering', 'ready', 'publishing', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."video_step_name" AS ENUM('script', 'voice', 'images', 'render', 'publish');--> statement-breakpoint
CREATE TYPE "public"."video_step_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" "credit_reason" NOT NULL,
	"video_id" uuid,
	"idempotency_key" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "credit_ledger_delta_not_zero" CHECK ("credit_ledger"."delta" <> 0),
	CONSTRAINT "credit_ledger_sign_matches_reason" CHECK (("credit_ledger"."reason" = 'video_debit' and "credit_ledger"."delta" < 0)
        or ("credit_ledger"."reason" in ('signup_bonus', 'monthly_grant', 'video_refund') and "credit_ledger"."delta" > 0)
        or "credit_ledger"."reason" = 'manual_adjustment')
);
--> statement-breakpoint
CREATE TABLE "music_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source" "music_source" NOT NULL,
	"name" text NOT NULL,
	"storage_key" text NOT NULL,
	"source_url" text,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_tracks_size_limit" CHECK ("music_tracks"."size_bytes" > 0 and "music_tracks"."size_bytes" <= 10485760)
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"formats" text[] NOT NULL,
	"niche" text NOT NULL,
	"language" text NOT NULL,
	"voice" text NOT NULL,
	"art_style" text NOT NULL,
	"caption_style" text NOT NULL,
	"platforms" "social_platform"[] DEFAULT '{}'::social_platform[] NOT NULL,
	"frequency" "posting_frequency" NOT NULL,
	"post_time" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"status" "series_status" DEFAULT 'active' NOT NULL,
	"used_topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_formats_not_empty" CHECK (cardinality("series"."formats") > 0),
	CONSTRAINT "series_post_time_format" CHECK ("series"."post_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
CREATE TABLE "series_music_tracks" (
	"series_id" uuid NOT NULL,
	"music_track_id" uuid NOT NULL,
	CONSTRAINT "series_music_tracks_series_id_music_track_id_pk" PRIMARY KEY("series_id","music_track_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" "social_platform" NOT NULL,
	"external_account_id" text NOT NULL,
	"username" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"plan" "plan" NOT NULL,
	"status" "subscription_status" NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"password_hash" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"auto_publish" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email"))
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "video_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"step" "video_step_name" NOT NULL,
	"status" "video_step_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"cost_micro_usd" bigint DEFAULT 0 NOT NULL,
	"output" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"status" "video_status" DEFAULT 'queued' NOT NULL,
	"script" jsonb,
	"audio_key" text,
	"video_key" text,
	"thumbnail_key" text,
	"duration_ms" integer,
	"error" text,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"published_urls" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_music_tracks" ADD CONSTRAINT "series_music_tracks_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_music_tracks" ADD CONSTRAINT "series_music_tracks_music_track_id_music_tracks_id_fk" FOREIGN KEY ("music_track_id") REFERENCES "public"."music_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_steps" ADD CONSTRAINT "video_steps_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_user_id_idx" ON "credit_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_video_reason_uq" ON "credit_ledger" USING btree ("video_id","reason") WHERE "credit_ledger"."video_id" is not null and "credit_ledger"."reason" in ('video_debit', 'video_refund');--> statement-breakpoint
CREATE INDEX "music_tracks_user_id_idx" ON "music_tracks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "series_user_id_idx" ON "series" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_connections_account_uq" ON "social_connections" USING btree ("user_id","platform","external_account_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_one_current_per_user_uq" ON "subscriptions" USING btree ("user_id") WHERE "subscriptions"."status" in ('active', 'trialing', 'past_due');--> statement-breakpoint
CREATE UNIQUE INDEX "video_steps_video_step_uq" ON "video_steps" USING btree ("video_id","step");--> statement-breakpoint
CREATE INDEX "videos_user_id_created_idx" ON "videos" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "videos_series_id_idx" ON "videos" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "videos_status_idx" ON "videos" USING btree ("status");