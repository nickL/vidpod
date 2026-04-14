import { pgEnum } from "drizzle-orm/pg-core"

export const mediaAssetKindEnum = pgEnum("media_asset_kind", ["video"])

export const mediaAssetStatusEnum = pgEnum("media_asset_status", [
  "uploading",
  "processing",
  "ready",
  "failed",
])

export const adAssetStatusEnum = pgEnum("ad_asset_status", ["active", "archived"])

export const adBreakSelectionModeEnum = pgEnum("ad_break_selection_mode", [
  "static",
  "auto",
  "ab",
])

export const adBreakStatusEnum = pgEnum("ad_break_status", ["draft", "active"])

export const adBreakVariantStatusEnum = pgEnum("ad_break_variant_status", [
  "active",
  "paused",
])
