export type MediaStatus = "uploading" | "processing" | "ready" | "failed"

export type Show = {
  id: string
  title: string
}

export type Episode = {
  id: string
  title: string
  editorConfigVersion: number
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

export type MarkerVariant = {
  id: string
  adAssetId: string
  adAssetTitle: string
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
}

export type MarkerActivation = {
  markerId: string
  requestedTimeMs: number
}

export type EditorData = {
  show: Show
  episode: Episode
  markers: Marker[]
  adLibrary: AdLibraryItem[]
  mainMediaAsset?: MediaAsset
}
