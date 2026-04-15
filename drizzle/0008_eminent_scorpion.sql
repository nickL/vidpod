CREATE TYPE "public"."transcription_job_status" AS ENUM('queued', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "media_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"text" text NOT NULL,
	"words_artifact_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcription_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"status" "transcription_job_status" DEFAULT 'queued' NOT NULL,
	"phase" text,
	"progress_message" text,
	"error" text,
	"total_chunks" integer,
	"completed_chunks" integer,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_transcripts" ADD CONSTRAINT "media_transcripts_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_transcripts" ADD CONSTRAINT "media_transcripts_job_id_transcription_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_transcripts_media_asset_id_idx" ON "media_transcripts" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "media_transcripts_job_id_idx" ON "media_transcripts" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_jobs_media_asset_id_idx" ON "transcription_jobs" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "transcription_jobs_status_idx" ON "transcription_jobs" USING btree ("status");