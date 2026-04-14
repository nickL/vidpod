CREATE TABLE "episode_video_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episode_video_assets" ADD CONSTRAINT "episode_video_assets_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_video_assets" ADD CONSTRAINT "episode_video_assets_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "episode_video_assets_episode_id_idx" ON "episode_video_assets" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX "episode_video_assets_media_asset_id_idx" ON "episode_video_assets" USING btree ("media_asset_id");