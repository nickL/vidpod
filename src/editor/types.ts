import type { Mp4ExportJobPhase } from "./mp4-export/phases"
import type { TranscriptJobPhase } from "./transcript/phases"

export type MediaStatus = "uploading" | "processing" | "ready" | "failed"
export type MediaWaveformStatus = "pending" | "processing" | "ready" | "failed"
export type Mp4ExportJobStatus = "queued" | "processing" | "ready" | "failed"
export type TranscriptJobStatus = "queued" | "processing" | "ready" | "failed"

export type MediaWaveform = {
  status: MediaWaveformStatus
  peaks?: number[]
  bucketCount?: number
  lastError?: string
}

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
  waveform?: MediaWaveform
}

export type AdLibraryItem = {
  id: string
  title: string
  status: "active" | "archived"
  createdAt: string
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
  thumbnailUrl?: string
  ordinal: number
  status: "active" | "paused"
  weight?: number
  isControl?: boolean
}

export type Marker = {
  id: string
  requestedTimeMs: number
  selectionMode: "static" | "auto" | "ab"
  status: "draft" | "active"
  label?: string
  variants: MarkerVariant[]
  canPlay: boolean
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

export type HlsPlan = {
  playbackSessionId: string
  episode: {
    id: string
    durationMs?: number
    playbackUrl: string
  }
  resolvedBreaks: Array<{
    adBreakId: string
    requestedTimeMs: number
    selectedVariant: {
      id: string
      adAssetId: string
      adAssetTitle: string
      mediaAsset: {
        id: string
        playbackUrl: string
        durationMs?: number
      }
    }
  }>
}

export type Mp4Plan = {
  playbackSessionId: string
  episode: {
    id: string
    title: string
    durationMs?: number
    playbackUrl: string
  }
  resolvedBreaks: HlsPlan["resolvedBreaks"]
}

export type Mp4ExportArtifact = {
  storage: "r2"
  key: string
  fileName: string
  contentType: "video/mp4"
  sizeBytes?: number
}

export type TranscriptArtifact = {
  storage: "r2"
  key: string
  fileName: string
  contentType: "application/json"
}

export type Mp4ExportJob = {
  id: string
  playbackSessionId: string
  status: Mp4ExportJobStatus
  phase?: Mp4ExportJobPhase
  progressMessage?: string
  error?: string
  output?: Mp4ExportArtifact
  createdAt: string
  startedAt?: string
  completedAt?: string
  updatedAt: string
}

export type TranscriptJob = {
  id: string
  mediaAssetId: string
  status: TranscriptJobStatus
  phase?: TranscriptJobPhase
  progressMessage?: string
  error?: string
  totalChunks?: number
  completedChunks?: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  updatedAt: string
}

export type TranscriptWord = {
  word: string
  start: number
  end: number
}

export type MediaTranscript = {
  id: string
  mediaAssetId: string
  jobId: string
  text: string
  words: TranscriptWord[]
  createdAt: string
  updatedAt: string
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
  transcriptJob?: TranscriptJob
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
