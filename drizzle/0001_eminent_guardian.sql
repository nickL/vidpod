CREATE TYPE "public"."playback_event_type" AS ENUM('session_started', 'break_resolved', 'ad_started', 'ad_completed', 'ad_failed');--> statement-breakpoint
CREATE TYPE "public"."playback_session_mode" AS ENUM('editor_preview');--> statement-breakpoint
CREATE TYPE "public"."playback_session_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TABLE "playback_break_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playback_session_id" uuid NOT NULL,
	"ad_break_id" uuid NOT NULL,
	"selected_variant_id" uuid NOT NULL,
	"selection_mode" "ad_break_selection_mode" NOT NULL,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playback_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playback_session_id" uuid NOT NULL,
	"ad_break_id" uuid,
	"selected_variant_id" uuid,
	"event_type" "playback_event_type" NOT NULL,
	"playhead_time_ms" integer,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playback_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"mode" "playback_session_mode" DEFAULT 'editor_preview' NOT NULL,
	"status" "playback_session_status" DEFAULT 'active' NOT NULL,
	"editor_config_version" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "playback_break_resolutions" ADD CONSTRAINT "playback_break_resolutions_playback_session_id_playback_sessions_id_fk" FOREIGN KEY ("playback_session_id") REFERENCES "public"."playback_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_break_resolutions" ADD CONSTRAINT "playback_break_resolutions_ad_break_id_ad_breaks_id_fk" FOREIGN KEY ("ad_break_id") REFERENCES "public"."ad_breaks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_break_resolutions" ADD CONSTRAINT "playback_break_resolutions_selected_variant_id_ad_break_variants_id_fk" FOREIGN KEY ("selected_variant_id") REFERENCES "public"."ad_break_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_events" ADD CONSTRAINT "playback_events_playback_session_id_playback_sessions_id_fk" FOREIGN KEY ("playback_session_id") REFERENCES "public"."playback_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_events" ADD CONSTRAINT "playback_events_ad_break_id_ad_breaks_id_fk" FOREIGN KEY ("ad_break_id") REFERENCES "public"."ad_breaks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_events" ADD CONSTRAINT "playback_events_selected_variant_id_ad_break_variants_id_fk" FOREIGN KEY ("selected_variant_id") REFERENCES "public"."ad_break_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playback_break_resolutions_session_id_idx" ON "playback_break_resolutions" USING btree ("playback_session_id");--> statement-breakpoint
CREATE INDEX "playback_break_resolutions_break_id_idx" ON "playback_break_resolutions" USING btree ("ad_break_id");--> statement-breakpoint
CREATE UNIQUE INDEX "playback_break_resolutions_session_break_idx" ON "playback_break_resolutions" USING btree ("playback_session_id","ad_break_id");--> statement-breakpoint
CREATE INDEX "playback_events_session_id_idx" ON "playback_events" USING btree ("playback_session_id");--> statement-breakpoint
CREATE INDEX "playback_events_break_id_idx" ON "playback_events" USING btree ("ad_break_id");--> statement-breakpoint
CREATE INDEX "playback_events_type_idx" ON "playback_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "playback_sessions_episode_id_idx" ON "playback_sessions" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX "playback_sessions_episode_status_idx" ON "playback_sessions" USING btree ("episode_id","status");