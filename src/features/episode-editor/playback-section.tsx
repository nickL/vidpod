"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { recordPlaybackEventAction, startPlaybackSessionAction } from "./actions"
import { HlsPreviewDialog } from "./hls-preview-dialog"
import { PlayerPanel } from "./player-panel"
import { Timeline } from "./timeline"
import { usePlayback } from "./use-playback"

import type {
  EpisodeVideoAsset,
  Marker,
  MarkerActivation,
  MediaAsset,
  UploadProgressState,
} from "./types"

type PlaybackSectionProps = {
  episodeId: string
  hlsBaseUrl?: string
  episodeDurationMs?: number
  mainMediaAsset?: MediaAsset
  replacementEpisodeVideo?: EpisodeVideoAsset
  uploadError?: string
  videoUploadProgress?: UploadProgressState
  markers: Marker[]
  previewConfigKey: string
  markerActivation?: MarkerActivation
  selectedMarkerId?: string
  canUndo: boolean
  canRedo: boolean
  onMarkerTimeCommit: (markerId: string, requestedTimeMs: number) => void
  onActivateMarker: (markerId: string, requestedTimeMs: number) => void
  onSelectMarker: (markerId: string) => void
  onUndo: () => void | Promise<void>
  onRedo: () => void | Promise<void>
  onDisplayTimeChange: (timeMs: number) => void
  onAddEpisodeVideo: (file: File) => void | Promise<void>
  onUseEpisodeVideo: (episodeVideoAssetId: string) => void | Promise<void>
}

const getPlaybackSessionStorageKey = (episodeId: string) => {
  return `vidpod:playback-session:${episodeId}`
}

export const PlaybackSection = ({
  episodeId,
  hlsBaseUrl,
  episodeDurationMs,
  mainMediaAsset,
  replacementEpisodeVideo,
  uploadError,
  videoUploadProgress,
  markers,
  previewConfigKey,
  markerActivation,
  selectedMarkerId,
  canUndo,
  canRedo,
  onMarkerTimeCommit,
  onActivateMarker,
  onSelectMarker,
  onUndo,
  onRedo,
  onDisplayTimeChange,
  onAddEpisodeVideo,
  onUseEpisodeVideo,
}: PlaybackSectionProps) => {
  const previewConfigKeyRef = useRef(previewConfigKey)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPreparingPreview, setIsPreparingPreview] = useState(false)
  const [previewManifestUrl, setPreviewManifestUrl] = useState<string>()
  const [previewError, setPreviewError] = useState<string>()
  const startPlaybackSession = useCallback(
    async (playheadTimeMs: number) => {
      const requestConfigKey = previewConfigKeyRef.current
      const storageKey = getPlaybackSessionStorageKey(episodeId)
      const storedPlaybackSessionId =
        window.sessionStorage.getItem(storageKey) ?? undefined
      const playbackSessionStart = await startPlaybackSessionAction({
        episodeId,
        playbackSessionId: storedPlaybackSessionId,
        playheadTimeMs,
      })

      if (requestConfigKey === previewConfigKeyRef.current) {
        window.sessionStorage.setItem(storageKey, playbackSessionStart.session.id)
      }

      return playbackSessionStart
    },
    [episodeId]
  )
  const normalizedHlsBaseUrl = useMemo(() => {
    return hlsBaseUrl?.replace(/\/$/, "")
  }, [hlsBaseUrl])
  const {
    currentTimeMs,
    durationMs,
    error,
    handleDurationChange,
    handleLoadedMetadata,
    handlePlaybackError,
    handleVideoEnded,
    handleScrubChange,
    handleScrubEnd,
    handleScrubStart,
    handleTimeUpdate,
    handleVideoPause,
    handleVideoPlay,
    isPlaying,
    isSeeking,
    jumpBy,
    playbackUrl,
    seekToEnd,
    seekToStart,
    selectedTimeMs,
    setVideoRef,
    seekToTime,
    togglePlayback,
  } = usePlayback({
    playbackUrl: mainMediaAsset?.playbackUrl,
    initialDurationMs: mainMediaAsset?.durationMs ?? episodeDurationMs,
    onBeforeFirstPlay: startPlaybackSession,
    onPlaybackEvent: recordPlaybackEventAction,
    previewConfigKey,
  })
  const displayTimeMs = isSeeking ? selectedTimeMs : currentTimeMs

  useEffect(() => {
    onDisplayTimeChange(displayTimeMs)
  }, [displayTimeMs, onDisplayTimeChange])

  useEffect(() => {
    if (previewConfigKeyRef.current === previewConfigKey) {
      return
    }

    previewConfigKeyRef.current = previewConfigKey
    window.sessionStorage.removeItem(getPlaybackSessionStorageKey(episodeId))
  }, [episodeId, previewConfigKey])

  useEffect(() => {
    if (!markerActivation) {
      return
    }

    seekToTime(markerActivation.requestedTimeMs)
  }, [markerActivation, seekToTime])

  usePlayPauseShortcut(togglePlayback)

  const openPreview = useCallback(async () => {
    if (!normalizedHlsBaseUrl) {
      return
    }

    setIsPreviewOpen(true)
    setIsPreparingPreview(true)
    setPreviewError(undefined)

    try {
      const playbackSessionStart = await startPlaybackSessionAction({
        episodeId,
        playheadTimeMs: 0,
      })

      setPreviewManifestUrl(
        `${normalizedHlsBaseUrl}/sessions/${playbackSessionStart.session.id}/master.m3u8`
      )
    } catch {
      setPreviewManifestUrl(undefined)
      setPreviewError("Unable to prepare HLS preview.")
    } finally {
      setIsPreparingPreview(false)
    }
  }, [episodeId, normalizedHlsBaseUrl])

  const handlePreviewOpenChange = useCallback((open: boolean) => {
    setIsPreviewOpen(open)

    if (open) {
      return
    }

    setIsPreparingPreview(false)
    setPreviewManifestUrl(undefined)
    setPreviewError(undefined)
  }, [])

  return (
    <>
      <PlayerPanel
        playbackUrl={playbackUrl}
        error={error}
        isPlaying={isPlaying}
        replacementEpisodeVideo={replacementEpisodeVideo}
        uploadError={uploadError}
        videoUploadProgress={videoUploadProgress}
        canPreviewHls={Boolean(normalizedHlsBaseUrl && mainMediaAsset?.playbackUrl)}
        isPreparingPreview={isPreparingPreview}
        setVideoRef={setVideoRef}
        onDurationChange={handleDurationChange}
        onLoadedMetadata={handleLoadedMetadata}
        onPlaybackError={handlePlaybackError}
        onVideoEnded={handleVideoEnded}
        onTimeUpdate={handleTimeUpdate}
        onVideoPause={handleVideoPause}
        onVideoPlay={handleVideoPlay}
        onJumpBy={jumpBy}
        onSeekToStart={seekToStart}
        onSeekToEnd={seekToEnd}
        onTogglePlayback={togglePlayback}
        onPreviewHls={openPreview}
        onAddEpisodeVideo={onAddEpisodeVideo}
        onUseEpisodeVideo={onUseEpisodeVideo}
      />
      <HlsPreviewDialog
        open={isPreviewOpen}
        manifestUrl={previewManifestUrl}
        isLoading={isPreparingPreview}
        error={previewError}
        onOpenChange={handlePreviewOpenChange}
      />
      <Timeline
        markers={markers}
        displayTimeMs={displayTimeMs}
        durationMs={durationMs}
        waveform={mainMediaAsset?.waveform}
        markerActivation={markerActivation}
        selectedMarkerId={selectedMarkerId}
        canUndo={canUndo}
        canRedo={canRedo}
        onMarkerTimeCommit={onMarkerTimeCommit}
        onActivateMarker={onActivateMarker}
        onSelectMarker={onSelectMarker}
        onUndo={onUndo}
        onRedo={onRedo}
        onScrubChange={handleScrubChange}
        onScrubEnd={handleScrubEnd}
        onScrubStart={handleScrubStart}
      />
    </>
  )
}

const EDITABLE_TARGET_SELECTOR =
  'input, textarea, select, button, [contenteditable="true"], [role="button"], [role="slider"], [role="textbox"], [role="menuitem"]'

const usePlayPauseShortcut = (togglePlayback: () => void | Promise<void>) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return
      }

      const target = event.target
      if (target instanceof Element && target.closest(EDITABLE_TARGET_SELECTOR)) {
        return
      }

      event.preventDefault()
      void togglePlayback()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [togglePlayback])
}
