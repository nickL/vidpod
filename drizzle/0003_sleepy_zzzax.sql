ALTER TABLE "playback_break_resolutions" DROP CONSTRAINT "playback_break_resolutions_selected_variant_id_ad_break_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "playback_break_resolutions" ALTER COLUMN "selected_variant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "playback_break_resolutions" ADD COLUMN "selected_ad_asset_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "playback_break_resolutions" ADD CONSTRAINT "playback_break_resolutions_selected_ad_asset_id_ad_assets_id_fk" FOREIGN KEY ("selected_ad_asset_id") REFERENCES "public"."ad_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_break_resolutions" ADD CONSTRAINT "playback_break_resolutions_selected_variant_id_ad_break_variants_id_fk" FOREIGN KEY ("selected_variant_id") REFERENCES "public"."ad_break_variants"("id") ON DELETE set null ON UPDATE no action;