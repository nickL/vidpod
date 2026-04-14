"use client"

import { useCallback, useEffect, useRef } from "react"

import { recordPlaybackEventAction, startPlaybackSessionAction } from "./actions"
import { PlayerPanel } from "./player-panel"
import { Timeline } from "./timeline"
import { usePlayback } from "./use-playback"

import type {
  Marker,
  MarkerActivation,
  MediaAsset,
} from "./types"

type PlaybackSectionProps = {
  episodeId: string
  title: string
  episodeDurationMs?: number
  mainMediaAsset?: MediaAsset
  markers: Marker[]
  previewConfigKey: string
  markerActivation?: MarkerActivation
  selectedMarkerId?: string
  onMarkerTimeCommit: (markerId: string, requestedTimeMs: number) => void
  onActivateMarker: (markerId: string, requestedTimeMs: number) => void
  onSelectMarker: (markerId: string) => void
}

const getPlaybackSessionStorageKey = (episodeId: string) => {
  return `vidpod:playback-session:${episodeId}`
}

export const PlaybackSection = ({
  episodeId,
  title,
  episodeDurationMs,
  mainMediaAsset,
  markers,
  previewConfigKey,
  markerActivation,
  selectedMarkerId,
  onMarkerTimeCommit,
  onActivateMarker,
  onSelectMarker,
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
    isPlaying,
    isReady,
    isSeeking,
    playbackUrl,
    selectedTimeMs,
    setIsPlaying,
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

  return (
    <>
      <PlayerPanel
        title={title}
        playbackUrl={playbackUrl}
        currentTimeMs={currentTimeMs}
        durationMs={durationMs}
        error={error}
        isPlaying={isPlaying}
        isReady={isReady}
        setVideoRef={setVideoRef}
        setIsPlaying={setIsPlaying}
        onDurationChange={handleDurationChange}
        onLoadedMetadata={handleLoadedMetadata}
        onPlaybackError={handlePlaybackError}
        onVideoEnded={handleVideoEnded}
        onTimeUpdate={handleTimeUpdate}
        onTogglePlayback={togglePlayback}
      />
      <Timeline
        markers={markers}
        displayTimeMs={displayTimeMs}
        durationMs={durationMs}
        markerActivation={markerActivation}
        selectedMarkerId={selectedMarkerId}
        onMarkerTimeCommit={onMarkerTimeCommit}
        onActivateMarker={onActivateMarker}
        onSelectMarker={onSelectMarker}
        onScrubChange={handleScrubChange}
        onScrubEnd={handleScrubEnd}
        onScrubStart={handleScrubStart}
      />
    </>
  )
}
