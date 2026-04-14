"use client"

import { useEffect } from "react"

import { PlayerPanel } from "./player-panel"
import { Timeline } from "./timeline"
import { usePlayback } from "./use-playback"

import type { Marker, MarkerActivation, MediaAsset } from "./types"

type PlaybackSectionProps = {
  title: string
  episodeDurationMs?: number
  mainMediaAsset?: MediaAsset
  markers: Marker[]
  markerActivation?: MarkerActivation
  selectedMarkerId?: string
  onMarkerTimeCommit: (markerId: string, requestedTimeMs: number) => void
  onActivateMarker: (markerId: string, requestedTimeMs: number) => void
  onSelectMarker: (markerId: string) => void
}

export const PlaybackSection = ({
  title,
  episodeDurationMs,
  mainMediaAsset,
  markers,
  markerActivation,
  selectedMarkerId,
  onMarkerTimeCommit,
  onActivateMarker,
  onSelectMarker,
}: PlaybackSectionProps) => {
  const {
    currentTimeMs,
    durationMs,
    error,
    handleDurationChange,
    handleLoadedMetadata,
    handlePlaybackError,
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
  })
  const displayTimeMs = isSeeking ? selectedTimeMs : currentTimeMs

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
