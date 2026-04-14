CREATE TYPE "public"."ad_asset_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."ad_break_selection_mode" AS ENUM('static', 'auto', 'ab');--> statement-breakpoint
CREATE TYPE "public"."ad_break_status" AS ENUM('draft', 'active');--> statement-breakpoint
CREATE TYPE "public"."ad_break_variant_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."media_asset_kind" AS ENUM('video');--> statement-breakpoint
CREATE TYPE "public"."media_asset_status" AS ENUM('uploading', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "ad_break_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_break_id" uuid NOT NULL,
	"ad_asset_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"weight" integer,
	"is_control" boolean,
	"status" "ad_break_variant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_breaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"requested_time_ms" integer NOT NULL,
	"resolved_time_ms" integer,
	"resolution_strategy" varchar(64),
	"selection_mode" "ad_break_selection_mode" DEFAULT 'static' NOT NULL,
	"status" "ad_break_status" DEFAULT 'draft' NOT NULL,
	"label" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"display_episode_number" varchar(64),
	"published_at" timestamp with time zone,
	"main_media_asset_id" uuid,
	"duration_ms" integer,
	"editor_config_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" "ad_asset_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_video_id" varchar(255) NOT NULL,
	"kind" "media_asset_kind" DEFAULT 'video' NOT NULL,
	"status" "media_asset_status" DEFAULT 'uploading' NOT NULL,
	"duration_ms" integer,
	"playback_url" text,
	"thumbnail_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_break_variants" ADD CONSTRAINT "ad_break_variants_ad_break_id_ad_breaks_id_fk" FOREIGN KEY ("ad_break_id") REFERENCES "public"."ad_breaks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_break_variants" ADD CONSTRAINT "ad_break_variants_ad_asset_id_ad_assets_id_fk" FOREIGN KEY ("ad_asset_id") REFERENCES "public"."ad_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_breaks" ADD CONSTRAINT "ad_breaks_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_main_media_asset_id_media_assets_id_fk" FOREIGN KEY ("main_media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_assets" ADD CONSTRAINT "ad_assets_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_assets" ADD CONSTRAINT "ad_assets_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_break_variants_break_id_idx" ON "ad_break_variants" USING btree ("ad_break_id");--> statement-breakpoint
CREATE INDEX "ad_break_variants_asset_id_idx" ON "ad_break_variants" USING btree ("ad_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_break_variants_break_ordinal_idx" ON "ad_break_variants" USING btree ("ad_break_id","ordinal");--> statement-breakpoint
CREATE INDEX "ad_breaks_episode_id_idx" ON "ad_breaks" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX "ad_breaks_episode_time_idx" ON "ad_breaks" USING btree ("episode_id","requested_time_ms");--> statement-breakpoint
CREATE INDEX "ad_breaks_episode_status_idx" ON "ad_breaks" USING btree ("episode_id","status");--> statement-breakpoint
CREATE INDEX "episodes_show_id_idx" ON "episodes" USING btree ("show_id");--> statement-breakpoint
CREATE INDEX "episodes_main_media_asset_id_idx" ON "episodes" USING btree ("main_media_asset_id");--> statement-breakpoint
CREATE INDEX "ad_assets_show_id_idx" ON "ad_assets" USING btree ("show_id");--> statement-breakpoint
CREATE INDEX "ad_assets_media_asset_id_idx" ON "ad_assets" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "ad_assets_status_idx" ON "ad_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "media_assets_status_idx" ON "media_assets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_stream_video_id_idx" ON "media_assets" USING btree ("stream_video_id");