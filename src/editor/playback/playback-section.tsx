"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  recordPlaybackEventAction,
  startMp4ExportJobAction,
  startPlaybackSessionAction,
} from "../actions"
import { HLSDebugModal } from "../mp4-export/hls-debug-modal"
import { PlayerPanel } from "./player-panel"
import { Timeline } from "../timeline"
import { usePlayback } from "./use-playback"

import type {
  EpisodeVideoAsset,
  Marker,
  MarkerActivation,
  MediaAsset,
  Mp4ExportJob,
  UploadProgressState,
} from "../types"

type PlaybackSectionProps = {
  episodeId: string
  hlsBaseUrl?: string
  episodeDurationMs?: number
  mainMediaAsset?: MediaAsset
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

const isRunningMp4Export = (job?: Mp4ExportJob) => {
  return job?.status === "queued" || job?.status === "processing"
}

export const PlaybackSection = ({
  episodeId,
  hlsBaseUrl,
  episodeDurationMs,
  mainMediaAsset,
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
  const [isStartingMp4Export, setIsStartingMp4Export] = useState(false)
  const [previewSessionId, setPreviewSessionId] = useState<string>()
  const [previewManifestUrl, setPreviewManifestUrl] = useState<string>()
  const [previewError, setPreviewError] = useState<string>()
  const [mp4Job, setMp4Job] = useState<Mp4ExportJob>()

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
    setIsStartingMp4Export(false)
    setPreviewSessionId(undefined)
    setPreviewManifestUrl(undefined)
    setPreviewError(undefined)
    setMp4Job(undefined)
  }, [episodeId, previewConfigKey])

  useEffect(() => {
    if (!markerActivation) {
      return
    }

    seekToTime(markerActivation.requestedTimeMs)
  }, [markerActivation, seekToTime])

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
    setMp4Job(undefined)

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

  const startMp4Export = useCallback(async () => {
    if (!previewSessionId || isStartingMp4Export) {
      return
    }

    setIsStartingMp4Export(true)
    setPreviewError(undefined)

    try {
      const job = await startMp4ExportJobAction(previewSessionId)
      setMp4Job(job)
    } catch (error) {
      setMp4Job(undefined)
      setPreviewError(
        error instanceof Error ? error.message : "Unable to generate MP4."
      )
    } finally {
      setIsStartingMp4Export(false)
    }
  }, [isStartingMp4Export, previewSessionId])

  const handlePreviewOpenChange = useCallback((open: boolean) => {
    setIsPreviewOpen(open)
  }, [])

  // Note: key the poll on the job id so setMp4Job() inside pollJob doesn't re-run this effect on every response.
  const runningJobId = isRunningMp4Export(mp4Job) ? mp4Job?.id : undefined

  useEffect(() => {
    if (!runningJobId) {
      return
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const pollJob = async () => {
      try {
        const response = await fetch(`/api/mp4-export-jobs/${runningJobId}`, {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Couldn't refresh MP4 export status.")
        }

        const nextJob = (await response.json()) as Mp4ExportJob

        if (cancelled) {
          return
        }

        setMp4Job(nextJob)

        if (isRunningMp4Export(nextJob)) {
          timeoutId = setTimeout(() => {
            void pollJob()
          }, 2000)
        }
      } catch {
        if (!cancelled) {
          timeoutId = setTimeout(() => {
            void pollJob()
          }, 2000)
        }
      }
    }

    void pollJob()

    return () => {
      cancelled = true

      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [runningJobId])

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
        canResetDemo={canResetDemo}
        isPreparingPreview={isPreparingPreview}
        isResettingDemo={isResettingDemo}
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
        onAddEpisodeVideo={onAddEpisodeVideo}
        onResetDemo={onResetDemo}
        onRemoveEpisodeVideo={onRemoveEpisodeVideo}
        onSelectEpisodeVideo={onSelectEpisodeVideo}
      />
      <HLSDebugModal
        open={isPreviewOpen}
        manifestUrl={previewManifestUrl}
        isLoading={isPreparingPreview}
        isStartingMp4Export={isStartingMp4Export}
        mp4Job={mp4Job}
        error={previewError}
        onGenerateMp4={startMp4Export}
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
