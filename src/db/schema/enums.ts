import { pgEnum } from "drizzle-orm/pg-core"

export const mediaAssetKindEnum = pgEnum("media_asset_kind", ["video"])

export const mediaAssetStatusEnum = pgEnum("media_asset_status", [
  "uploading",
  "processing",
  "ready",
  "failed",
])

export const mediaWaveformStatusEnum = pgEnum("media_waveform_status", [
  "pending",
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

export const playbackSessionModeEnum = pgEnum("playback_session_mode", [
  "editor_preview",
])

export const playbackSessionStatusEnum = pgEnum("playback_session_status", [
  "active",
  "ended",
])

export const playbackEventTypeEnum = pgEnum("playback_event_type", [
  "session_started",
  "break_resolved",
  "ad_started",
  "ad_completed",
  "ad_failed",
])
