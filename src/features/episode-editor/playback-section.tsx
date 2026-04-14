"use client"

import { useCallback, useEffect, useRef } from "react"

import { recordPlaybackEventAction, startPlaybackSessionAction } from "./actions"
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

  return (
    <>
      <PlayerPanel
        playbackUrl={playbackUrl}
        error={error}
        isPlaying={isPlaying}
        replacementEpisodeVideo={replacementEpisodeVideo}
        uploadError={uploadError}
        videoUploadProgress={videoUploadProgress}
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
        onAddEpisodeVideo={onAddEpisodeVideo}
        onUseEpisodeVideo={onUseEpisodeVideo}
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
