"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Hls from "hls.js"

import { clampTimeMs, msToSeconds, secondsToMs } from "./time"

import type {
  PlaybackEventInput,
  PlaybackSessionStart,
  ResolvedPlaybackBreak,
} from "./types"

type UsePlaybackOptions = {
  playbackUrl?: string
  initialDurationMs?: number
  onBeforeFirstPlay?: (playheadTimeMs: number) => Promise<PlaybackSessionStart>
  onPlaybackEvent?: (event: PlaybackEventInput) => Promise<void>
  previewConfigKey?: string
}

type ActivePlaybackSource =
  | {
      kind: "episode"
    }
  | {
      kind: "ad"
      playbackBreak: ResolvedPlaybackBreak
      resumeTimeMs: number
    }

const PREVIEW_SEEK_INTERVAL_MS = 75

const getPlaybackError = ({
  playbackError,
  playbackUrl,
  supportsPlayback,
}: {
  playbackError?: string
  playbackUrl?: string
  supportsPlayback: boolean
}) => {
  if (!playbackUrl) {
    return "Playback not available"
  }

  if (!supportsPlayback) {
    return "Browser unable to play video stream"
  }

  return playbackError
}

const getVideoDurationMs = (video: HTMLVideoElement) => {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return undefined
  }

  return secondsToMs(video.duration)
}

const buildPlayedBreakIds = (
  resolvedBreaks: ResolvedPlaybackBreak[],
  currentTimeMs: number
) => {
  return new Set(
    resolvedBreaks
      .filter((playbackBreak) => playbackBreak.requestedTimeMs <= currentTimeMs)
      .map((playbackBreak) => playbackBreak.adBreakId)
  )
}

const findTriggeredBreak = ({
  previousTimeMs,
  currentTimeMs,
  playedBreakIds,
  resolvedBreaks,
}: {
  previousTimeMs: number
  currentTimeMs: number
  playedBreakIds: Set<string>
  resolvedBreaks: ResolvedPlaybackBreak[]
}) => {
  return resolvedBreaks.find((playbackBreak) => {
    if (playedBreakIds.has(playbackBreak.adBreakId)) {
      return false
    }

    return (
      previousTimeMs <= playbackBreak.requestedTimeMs &&
      playbackBreak.requestedTimeMs <= currentTimeMs
    )
  })
}

export const usePlayback = ({
  playbackUrl: episodePlaybackUrl,
  initialDurationMs,
  onBeforeFirstPlay,
  onPlaybackEvent,
  previewConfigKey,
}: UsePlaybackOptions) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)

  const [episodeLoadedDurationMs, setEpisodeLoadedDurationMs] = useState<number>()
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [selectedTimeMs, setSelectedTimeMs] = useState(0)
  const [activePlaybackSource, setActivePlaybackSource] =
    useState<ActivePlaybackSource>({
      kind: "episode",
    })

  const [isPlaying, setIsPlaying] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [playbackError, setPlaybackError] = useState<string>()

  const playbackSessionIdRef = useRef<string | undefined>(undefined)
  const hasPlaybackSessionRef = useRef(false)
  const pendingSessionStartRef = useRef<Promise<PlaybackSessionStart> | undefined>(
    undefined
  )
  const resolvedBreaksRef = useRef<ResolvedPlaybackBreak[]>([])
  const playedBreakIdsRef = useRef<Set<string>>(new Set())
  const previewConfigKeyRef = useRef(previewConfigKey)

  const previewSeekTimeoutRef = useRef<number | undefined>(undefined)
  const pendingPreviewTimeRef = useRef<number | undefined>(undefined)
  const lastPreviewSeekAtRef = useRef(0)
  const scrubTimeRef = useRef(0)

  const lastEpisodeTimeMsRef = useRef(0)
  const activePlaybackSourceRef = useRef(activePlaybackSource)
  const pendingSourceTimeRef = useRef<number | undefined>(undefined)
  const shouldAutoplayRef = useRef(false)

  useEffect(() => {
    activePlaybackSourceRef.current = activePlaybackSource
  }, [activePlaybackSource])

  const durationMs = episodeLoadedDurationMs ?? initialDurationMs ?? 0

  const activePlaybackUrl =
    activePlaybackSource.kind === "episode"
      ? episodePlaybackUrl
      : activePlaybackSource.playbackBreak.selectedVariant.mediaAsset.playbackUrl

  const supportsNativeHls = videoElement
    ? !!videoElement.canPlayType("application/vnd.apple.mpegurl")
    : false

  const supportsStreamPlayback =
    !videoElement || supportsNativeHls || Hls.isSupported()
  const error = getPlaybackError({
    playbackError,
    playbackUrl: activePlaybackUrl,
    supportsPlayback: supportsStreamPlayback,
  })

  const clearPreviewSeekTimeout = useCallback(() => {
    if (previewSeekTimeoutRef.current === undefined) {
      return
    }

    window.clearTimeout(previewSeekTimeoutRef.current)
    previewSeekTimeoutRef.current = undefined
  }, [])

  const updateScrubTime = useCallback((timeMs: number) => {
    scrubTimeRef.current = timeMs
    setCurrentTimeMs(timeMs)
    setSelectedTimeMs(timeMs)
  }, [])

  const syncPlayedBreaks = useCallback((timeMs: number) => {
    playedBreakIdsRef.current = buildPlayedBreakIds(
      resolvedBreaksRef.current,
      timeMs
    )
  }, [])

  const logPlaybackEvent = useCallback(
    (event: Omit<PlaybackEventInput, "playbackSessionId">) => {
      const playbackSessionId = playbackSessionIdRef.current

      if (!playbackSessionId || !onPlaybackEvent) {
        return
      }

      void onPlaybackEvent({
        playbackSessionId,
        ...event,
      }).catch(() => undefined)
    },
    [onPlaybackEvent]
  )

  const applyPlaybackSession = useCallback(
    (playbackSessionStart: PlaybackSessionStart) => {
      hasPlaybackSessionRef.current = true
      playbackSessionIdRef.current = playbackSessionStart.session.id
      resolvedBreaksRef.current = playbackSessionStart.resolvedBreaks
      syncPlayedBreaks(scrubTimeRef.current)
    },
    [syncPlayedBreaks]
  )

  const resetPlaybackSession = useCallback(() => {
    hasPlaybackSessionRef.current = false
    pendingSessionStartRef.current = undefined
    playbackSessionIdRef.current = undefined
    resolvedBreaksRef.current = []
    playedBreakIdsRef.current = new Set()
  }, [])

  const switchToEpisodePlayback = useCallback(
    ({
      timeMs,
      shouldPlay,
    }: {
      timeMs: number
      shouldPlay: boolean
    }) => {
      const nextTimeMs = clampTimeMs(timeMs, durationMs)

      clearPreviewSeekTimeout()
      pendingPreviewTimeRef.current = undefined
      pendingSourceTimeRef.current = nextTimeMs
      shouldAutoplayRef.current = shouldPlay
      lastEpisodeTimeMsRef.current = nextTimeMs
      syncPlayedBreaks(nextTimeMs)
      updateScrubTime(nextTimeMs)
      setActivePlaybackSource({
        kind: "episode",
      })
    },
    [clearPreviewSeekTimeout, durationMs, syncPlayedBreaks, updateScrubTime]
  )

  useEffect(() => {
    if (previewConfigKeyRef.current === previewConfigKey) {
      return
    }

    previewConfigKeyRef.current = previewConfigKey
    resetPlaybackSession()

    if (activePlaybackSourceRef.current.kind !== "ad") {
      return
    }

    const shouldPlay = Boolean(videoRef.current && !videoRef.current.paused)

    switchToEpisodePlayback({
      timeMs: activePlaybackSourceRef.current.resumeTimeMs,
      shouldPlay,
    })
  }, [previewConfigKey, resetPlaybackSession, switchToEpisodePlayback])

  const finishActiveAd = useCallback(
    ({
      eventType,
      metadataJson,
      shouldPlay,
    }: {
      eventType: "ad_completed" | "ad_failed"
      metadataJson?: Record<string, unknown>
      shouldPlay: boolean
    }) => {
      const activeSource = activePlaybackSourceRef.current

      if (activeSource.kind !== "ad") {
        return
      }

      logPlaybackEvent({
        adBreakId: activeSource.playbackBreak.adBreakId,
        selectedVariantId: activeSource.playbackBreak.selectedVariant.id,
        eventType,
        playheadTimeMs: activeSource.resumeTimeMs,
        metadataJson,
      })

      switchToEpisodePlayback({
        timeMs: activeSource.resumeTimeMs,
        shouldPlay,
      })
    },
    [logPlaybackEvent, switchToEpisodePlayback]
  )

  useEffect(() => {
    const video = videoRef.current

    if (!video || !videoElement || !activePlaybackUrl || !supportsStreamPlayback) {
      return
    }

    let hls: Hls | undefined

    if (supportsNativeHls) {
      video.src = activePlaybackUrl
    } else {
      hls = new Hls()
      hls.loadSource(activePlaybackUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (activePlaybackSourceRef.current.kind === "ad") {
            finishActiveAd({
              eventType: "ad_failed",
              metadataJson: {
                reason: "stream_load_failed",
              },
              shouldPlay: true,
            })
            return
          }

          setPlaybackError("Unable to load stream playback")
        }
      })
    }

    return () => {
      if (hls) {
        hls.destroy()
        return
      }

      video.pause()
      video.removeAttribute("src")
      video.load()
    }
  }, [
    activePlaybackUrl,
    finishActiveAd,
    supportsNativeHls,
    supportsStreamPlayback,
    videoElement,
  ])

  const startAdBreak = (playbackBreak: ResolvedPlaybackBreak) => {
    const video = videoRef.current

    if (!video) {
      return
    }

    const resumeTimeMs = playbackBreak.requestedTimeMs

    playedBreakIdsRef.current.add(playbackBreak.adBreakId)
    lastEpisodeTimeMsRef.current = resumeTimeMs
    updateScrubTime(resumeTimeMs)
    pendingSourceTimeRef.current = 0
    shouldAutoplayRef.current = true
    video.pause()
    setActivePlaybackSource({
      kind: "ad",
      playbackBreak,
      resumeTimeMs,
    })

    logPlaybackEvent({
      adBreakId: playbackBreak.adBreakId,
      selectedVariantId: playbackBreak.selectedVariant.id,
      eventType: "ad_started",
      playheadTimeMs: resumeTimeMs,
    })
  }

  useEffect(() => {
    return () => {
      clearPreviewSeekTimeout()
    }
  }, [clearPreviewSeekTimeout])

  const updatePlaybackTime = (timeMs: number) => {
    if (isSeeking || activePlaybackSourceRef.current.kind !== "episode") {
      return
    }

    updateScrubTime(clampTimeMs(timeMs, durationMs))
  }

  const updateLoadedDuration = (video: HTMLVideoElement) => {
    const nextDurationMs = getVideoDurationMs(video)

    if (nextDurationMs) {
      setEpisodeLoadedDurationMs(nextDurationMs)
    }
  }

  const seekToTime = useCallback(
    (timeMs: number) => {
      const nextTimeMs = clampTimeMs(timeMs, durationMs)
      const video = videoRef.current
      const shouldResumePlayback = Boolean(video && !video.paused)

      if (activePlaybackSourceRef.current.kind === "episode" && video) {
        clearPreviewSeekTimeout()
        pendingPreviewTimeRef.current = undefined
        lastEpisodeTimeMsRef.current = nextTimeMs
        syncPlayedBreaks(nextTimeMs)
        updateScrubTime(nextTimeMs)
        video.currentTime = msToSeconds(nextTimeMs)
        return
      }

      switchToEpisodePlayback({
        timeMs: nextTimeMs,
        shouldPlay: shouldResumePlayback,
      })
    },
    [
      clearPreviewSeekTimeout,
      durationMs,
      switchToEpisodePlayback,
      syncPlayedBreaks,
      updateScrubTime,
    ]
  )

  const applyPreviewSeek = () => {
    clearPreviewSeekTimeout()

    if (activePlaybackSourceRef.current.kind !== "episode") {
      return
    }

    const video = videoRef.current
    const nextTimeMs = pendingPreviewTimeRef.current

    if (!video || nextTimeMs === undefined) {
      return
    }

    pendingPreviewTimeRef.current = undefined
    lastPreviewSeekAtRef.current = performance.now()
    video.currentTime = msToSeconds(nextTimeMs)
  }

  const queuePreviewSeek = (timeMs: number) => {
    pendingPreviewTimeRef.current = clampTimeMs(timeMs, durationMs)

    if (previewSeekTimeoutRef.current !== undefined) {
      return
    }

    const elapsedMs = performance.now() - lastPreviewSeekAtRef.current
    const delayMs =
      lastPreviewSeekAtRef.current === 0
        ? 0
        : Math.max(0, PREVIEW_SEEK_INTERVAL_MS - elapsedMs)

    previewSeekTimeoutRef.current = window.setTimeout(
      applyPreviewSeek,
      delayMs
    )
  }

  const handleLoadedMetadata = () => {
    const video = videoRef.current

    if (!video) {
      return
    }

    if (activePlaybackSourceRef.current.kind === "episode") {
      updateLoadedDuration(video)
    }

    const pendingSeekTimeMs = pendingSourceTimeRef.current

    if (pendingSeekTimeMs !== undefined) {
      video.currentTime = msToSeconds(pendingSeekTimeMs)
      pendingSourceTimeRef.current = undefined
    } else if (activePlaybackSourceRef.current.kind === "episode") {
      updatePlaybackTime(secondsToMs(video.currentTime))
      lastEpisodeTimeMsRef.current = secondsToMs(video.currentTime)
    }

    setIsReady(true)
    setPlaybackError(undefined)

    if (!shouldAutoplayRef.current) {
      return
    }

    shouldAutoplayRef.current = false
    void video.play().catch(() => {
      if (activePlaybackSourceRef.current.kind === "ad") {
        finishActiveAd({
          eventType: "ad_failed",
          metadataJson: {
            reason: "autoplay_failed",
          },
          shouldPlay: true,
        })
        return
      }

      setPlaybackError("Unable to start playback")
    })
  }

  const handleDurationChange = () => {
    const video = videoRef.current

    if (!video || activePlaybackSourceRef.current.kind !== "episode") {
      return
    }

    updateLoadedDuration(video)
  }

  const handleTimeUpdate = () => {
    const video = videoRef.current

    if (!video || activePlaybackSourceRef.current.kind !== "episode") {
      return
    }

    const nextTimeMs = secondsToMs(video.currentTime)
    const triggeredBreak = findTriggeredBreak({
      previousTimeMs: lastEpisodeTimeMsRef.current,
      currentTimeMs: nextTimeMs,
      playedBreakIds: playedBreakIdsRef.current,
      resolvedBreaks: resolvedBreaksRef.current,
    })

    if (triggeredBreak) {
      startAdBreak(triggeredBreak)
      return
    }

    lastEpisodeTimeMsRef.current = nextTimeMs
    updatePlaybackTime(nextTimeMs)
  }

  const handlePlaybackError = () => {
    if (activePlaybackSourceRef.current.kind === "ad") {
      finishActiveAd({
        eventType: "ad_failed",
        metadataJson: {
          reason: "playback_error",
        },
        shouldPlay: true,
      })
      return
    }

    setPlaybackError("Unable to play this media stream")
  }

  const handleVideoEnded = () => {
    if (activePlaybackSourceRef.current.kind !== "ad") {
      return
    }

    finishActiveAd({
      eventType: "ad_completed",
      shouldPlay: true,
    })
  }

  const handleVideoPlay = () => {
    setIsPlaying(true)
  }

  const handleVideoPause = () => {
    setIsPlaying(false)
  }

  const startScrub = () => {
    setIsSeeking(true)
  }

  const updateScrub = (timeMs: number) => {
    const nextTimeMs = clampTimeMs(timeMs, durationMs)

    setIsSeeking(true)
    updateScrubTime(nextTimeMs)

    if (activePlaybackSourceRef.current.kind !== "episode") {
      return
    }

    queuePreviewSeek(nextTimeMs)
  }

  const finishScrub = () => {
    clearPreviewSeekTimeout()
    pendingPreviewTimeRef.current = undefined
    seekToTime(scrubTimeRef.current)
    setIsSeeking(false)
  }

  const startPlaybackSessionIfNeeded = async (): Promise<void> => {
    if (!onBeforeFirstPlay || hasPlaybackSessionRef.current) {
      return
    }

    const requestConfigKey = previewConfigKeyRef.current

    if (!pendingSessionStartRef.current) {
      const sessionStartPromise = onBeforeFirstPlay(
        scrubTimeRef.current
      )
        .finally(() => {
          if (pendingSessionStartRef.current === sessionStartPromise) {
            pendingSessionStartRef.current = undefined
          }
        })

      pendingSessionStartRef.current = sessionStartPromise
    }

    const playbackSessionStart = await pendingSessionStartRef.current

    if (requestConfigKey !== previewConfigKeyRef.current) {
      return startPlaybackSessionIfNeeded()
    }

    applyPlaybackSession(playbackSessionStart)
  }

  const play = async () => {
    const video = videoRef.current

    if (!video) {
      return
    }

    try {
      await startPlaybackSessionIfNeeded()

      if (!video.paused) {
        return
      }

      await video.play()
      setPlaybackError(undefined)
    } catch {
      setPlaybackError("Unable to start playback")
    }
  }

  const pause = () => {
    videoRef.current?.pause()
  }

  const togglePlayback = async () => {
    const video = videoRef.current

    if (!video) {
      return
    }

    if (video.paused) {
      await play()
    } else {
      pause()
    }
  }

  const jumpBy = (deltaMs: number) => {
    seekToTime(scrubTimeRef.current + deltaMs)
  }

  const seekToStart = () => {
    seekToTime(0)
  }

  const seekToEnd = () => {
    seekToTime(durationMs)
  }

  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    setVideoElement(node)
  }, [])

  return {
    currentTimeMs,
    durationMs,
    error,
    isPlaying,
    isReady,
    isSeeking,
    playbackUrl: activePlaybackUrl,
    selectedTimeMs,
    setVideoRef,
    handleDurationChange,
    handleLoadedMetadata,
    handlePlaybackError,
    handleScrubChange: updateScrub,
    handleScrubEnd: finishScrub,
    handleScrubStart: startScrub,
    handleTimeUpdate,
    handleVideoEnded,
    handleVideoPause,
    handleVideoPlay,
    jumpBy,
    pause,
    play,
    seekToEnd,
    seekToStart,
    seekToTime,
    togglePlayback,
  }
}
