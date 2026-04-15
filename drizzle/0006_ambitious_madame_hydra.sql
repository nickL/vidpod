CREATE TYPE "public"."mp4_export_job_status" AS ENUM('queued', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "mp4_export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playback_session_id" uuid NOT NULL,
	"status" "mp4_export_job_status" DEFAULT 'queued' NOT NULL,
	"output_json" jsonb,
	"progress_message" text,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mp4_export_jobs" ADD CONSTRAINT "mp4_export_jobs_playback_session_id_playback_sessions_id_fk" FOREIGN KEY ("playback_session_id") REFERENCES "public"."playback_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mp4_export_jobs_session_id_idx" ON "mp4_export_jobs" USING btree ("playback_session_id");--> statement-breakpoint
CREATE INDEX "mp4_export_jobs_status_idx" ON "mp4_export_jobs" USING btree ("status");
