export type MediaStatus = "uploading" | "processing" | "ready" | "failed"

export type Show = {
  id: string
  title: string
}

export type Episode = {
  id: string
  title: string
  displayEpisodeNumber?: string
  publishedAt?: string
  durationMs?: number
}

export type MediaAsset = {
  id: string
  streamVideoId: string
  status: MediaStatus
  durationMs?: number
  playbackUrl?: string
  thumbnailUrl?: string
}

export type AdLibraryItem = {
  id: string
  title: string
  status: "active" | "archived"
  mediaAsset: {
    id: string
    streamVideoId: string
    status: MediaStatus
    durationMs?: number
    thumbnailUrl?: string
  }
}

export type EpisodeVideoAsset = {
  id: string
  title: string
  createdAt: string
  mediaAsset: MediaAsset
}

export type MarkerVariant = {
  id: string
  adAssetId: string
  adAssetTitle: string
  ordinal: number
  status: "active" | "paused"
  weight?: number
  isControl?: boolean
}

export type MarkerPlaybackReasonCode =
  | "needs_variant"
  | "needs_more_variants_for_ab"
  | "asset_unavailable"
  | "invalid_break_time"
  | "invalid_static_variant_count"

export type MarkerPlaybackReasonSeverity = "guidance" | "warning"

export type MarkerPlaybackReadiness = {
  canPlay: boolean
  reasonCode?: MarkerPlaybackReasonCode
  reasonSeverity?: MarkerPlaybackReasonSeverity
}

export type Marker = {
  id: string
  requestedTimeMs: number
  selectionMode: "static" | "auto" | "ab"
  status: "draft" | "active"
  label?: string
  variants: MarkerVariant[]
  playbackReadiness: MarkerPlaybackReadiness
}

export type MarkerActivation = {
  markerId: string
  requestedTimeMs: number
}

export type PlaybackSession = {
  id: string
  status: "active" | "ended"
  startedAt: string
}

export type ResolvedPlaybackBreak = {
  adBreakId: string
  requestedTimeMs: number
  selectedVariant: {
    id: string
    adAssetId: string
    adAssetTitle: string
    mediaAsset: MediaAsset
  }
}

export type PlaybackSessionStart = {
  session: PlaybackSession
  resolvedBreaks: ResolvedPlaybackBreak[]
}

export type PlaybackEventInput = {
  playbackSessionId: string
  adBreakId: string
  selectedVariantId: string
  eventType: "ad_started" | "ad_completed" | "ad_failed"
  playheadTimeMs?: number
  metadataJson?: Record<string, unknown>
}

export type EditorData = {
  show: Show
  episode: Episode
  markers: Marker[]
  adLibrary: AdLibraryItem[]
  episodeVideoAssets: EpisodeVideoAsset[]
  canResetDemo: boolean
  mainMediaAsset?: MediaAsset
}

export type UploadTarget = "episode" | "ad"

export type UploadInitInput = {
  target: UploadTarget
  episodeId: string
  filename: string
  fileSize: number
}

export type UploadInitResult =
  | {
      target: "episode"
      uploadUrl: string
      episodeVideoAsset: EpisodeVideoAsset
    }
  | {
      target: "ad"
      uploadUrl: string
      adLibraryItem: AdLibraryItem
    }

export type UploadProgressState = {
  phase: "uploading" | "processing"
  progressPercent: number
}
