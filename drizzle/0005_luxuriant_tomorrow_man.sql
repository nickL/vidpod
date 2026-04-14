CREATE TYPE "public"."media_waveform_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "media_waveforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"status" "media_waveform_status" DEFAULT 'pending' NOT NULL,
	"peaks" jsonb,
	"bucket_count" integer,
	"last_error" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_waveforms" ADD CONSTRAINT "media_waveforms_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_waveforms_media_asset_id_idx" ON "media_waveforms" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "media_waveforms_status_idx" ON "media_waveforms" USING btree ("status");