"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence } from "motion/react"

import {
  recordPlaybackEventAction,
  startPlaybackSessionAction,
} from "../actions"
import { HLSDebugModal } from "../mp4-export/hls-debug-modal"
import { useMp4ExportJob } from "../mp4-export/use-mp4-export-job"
import { PlayerPanel } from "./player-panel"
import { Timeline } from "../timeline"
import { TranscriptPanel } from "../transcript/transcript-panel"
import { useTranscript } from "../transcript/use-transcript"
import { usePlayback } from "./use-playback"

import type {
  EpisodeVideoAsset,
  Marker,
  MarkerActivation,
  MediaAsset,
  TranscriptJob,
  UploadProgressState,
} from "../types"

type PlaybackSectionProps = {
  episodeId: string
  hlsBaseUrl?: string
  episodeDurationMs?: number
  mainMediaAsset?: MediaAsset
  transcriptJob?: TranscriptJob
  replacementEpisodeVideo?: EpisodeVideoAsset
  uploadError?: string
  videoUploadProgress?: UploadProgressState
  canResetDemo: boolean
  isResettingDemo: boolean
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
  onResetDemo: () => void | Promise<void>
  onRemoveEpisodeVideo: (episodeVideoAssetId: string) => void | Promise<void>
  onSelectEpisodeVideo: (episodeVideoAssetId: string) => void | Promise<void>
}

const getPlaybackSessionStorageKey = (episodeId: string) => {
  return `vidpod:playback-session:${episodeId}`
}

export const PlaybackSection = ({
  episodeId,
  hlsBaseUrl,
  episodeDurationMs,
  mainMediaAsset,
  transcriptJob,
  replacementEpisodeVideo,
  uploadError,
  videoUploadProgress,
  canResetDemo,
  isResettingDemo,
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
  onResetDemo,
  onRemoveEpisodeVideo,
  onSelectEpisodeVideo,
}: PlaybackSectionProps) => {
  const previewConfigKeyRef = useRef(previewConfigKey)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPreparingPreview, setIsPreparingPreview] = useState(false)
  const [previewSessionId, setPreviewSessionId] = useState<string>()
  const [previewManifestUrl, setPreviewManifestUrl] = useState<string>()
  const [previewError, setPreviewError] = useState<string>()
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false)
  const { transcript } = useTranscript({
    mainMediaAssetId: mainMediaAsset?.id,
    initialJob: transcriptJob,
  })
  const canShowTranscript =
    transcript.status === "processing" || transcript.status === "ready"
  const mp4Export = useMp4ExportJob({ episodeId, previewConfigKey })

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

      // Note: The preview config changed mid-request, so don't persist a session ID against wrong config.
      if (requestConfigKey === previewConfigKeyRef.current) {
        window.sessionStorage.setItem(storageKey, playbackSessionStart.session.id)
      }

      return playbackSessionStart
    },
    [episodeId]
  )
  const normalizedHlsBaseUrl = hlsBaseUrl?.replace(/\/$/, "")
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
    setIsPreviewOpen(false)
    setIsPreparingPreview(false)
    setPreviewSessionId(undefined)
    setPreviewManifestUrl(undefined)
    setPreviewError(undefined)
  }, [episodeId, previewConfigKey])

  useEffect(() => {
    if (!markerActivation) {
      return
    }

    seekToTime(markerActivation.requestedTimeMs)
  }, [markerActivation, seekToTime])

  useEffect(() => {
    if (!canShowTranscript) {
      setIsTranscriptOpen(false)
    }
  }, [canShowTranscript])

  // Toggle Playback via Spacebar
  useSpacebarPlayPause(togglePlayback)

  const openHlsPreview = useCallback(async () => {
    if (!normalizedHlsBaseUrl) {
      return
    }

    if (previewSessionId && previewManifestUrl) {
      setIsPreviewOpen(true)
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

      setPreviewSessionId(playbackSessionStart.session.id)
      setPreviewManifestUrl(
        `${normalizedHlsBaseUrl}/sessions/${playbackSessionStart.session.id}/master.m3u8`
      )
    } catch {
      setPreviewSessionId(undefined)
      setPreviewManifestUrl(undefined)
      setPreviewError("Uh oh - Error preparing HLS preview (Try again)")
    } finally {
      setIsPreparingPreview(false)
    }
  }, [episodeId, normalizedHlsBaseUrl, previewManifestUrl, previewSessionId])

  const handlePreviewOpenChange = useCallback((open: boolean) => {
    setIsPreviewOpen(open)
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
        canPreviewHls={!!(normalizedHlsBaseUrl && mainMediaAsset?.playbackUrl)}
        canExportMp4={!!(mainMediaAsset?.playbackUrl)}
        canResetDemo={canResetDemo}
        isPreparingPreview={isPreparingPreview}
        isResettingDemo={isResettingDemo}
        mp4Job={mp4Export.job}
        isStartingMp4Export={mp4Export.isStarting}
        mp4ExportError={mp4Export.error}
        setVideoRef={setVideoRef}
        onDurationChange={handleDurationChange}
        onLoadedMetadata={handleLoadedMetadata}
        onPlaybackError={handlePlaybackError}
        onVideoEnded={handleVideoEnded}
        onTimeUpdate={handleTimeUpdate}
        onVideoPause={handleVideoPause}
        onVideoPlay={handleVideoPlay}
        onJumpBy={jumpBy}
        onJumpToStart={seekToStart}
        onJumpToEnd={seekToEnd}
        onTogglePlayback={togglePlayback}
        onPreviewHls={openHlsPreview}
        onGenerateMp4={mp4Export.start}
        onRegenerateMp4={mp4Export.regenerate}
        onAddEpisodeVideo={onAddEpisodeVideo}
        onResetDemo={onResetDemo}
        onRemoveEpisodeVideo={onRemoveEpisodeVideo}
        onSelectEpisodeVideo={onSelectEpisodeVideo}
      />
      <HLSDebugModal
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
        isPlaying={isPlaying}
        markerActivation={markerActivation}
        selectedMarkerId={selectedMarkerId}
        canUndo={canUndo}
        canRedo={canRedo}
        transcript={
          canShowTranscript
            ? {
                isOpen: isTranscriptOpen,
                onToggle: () => setIsTranscriptOpen((open) => !open),
              }
            : undefined
        }
        onMarkerTimeCommit={onMarkerTimeCommit}
        onActivateMarker={onActivateMarker}
        onSelectMarker={onSelectMarker}
        onUndo={onUndo}
        onRedo={onRedo}
        onScrubChange={handleScrubChange}
        onScrubEnd={handleScrubEnd}
        onScrubStart={handleScrubStart}
      />
      <AnimatePresence>
        {canShowTranscript && isTranscriptOpen ? (
          <TranscriptPanel
            key="transcript-panel"
            transcript={transcript}
            currentTimeMs={displayTimeMs}
            onSeek={seekToTime}
            onClose={() => setIsTranscriptOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}


/* Spacebar Playback Toggling */

// Note: Don't steal spacebar when focus is within an editable input (e.g typing, slider, etc).

const EDITABLE_TARGET_SELECTOR =
  'input, textarea, select, button, [contenteditable="true"], [role="button"], [role="slider"], [role="textbox"], [role="menuitem"]'

const useSpacebarPlayPause = (togglePlayback: () => void | Promise<void>) => {
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
