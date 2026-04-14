"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Hls from "hls.js"

import { clampTimeMs, msToSeconds, secondsToMs } from "./time"

type UsePlaybackOptions = {
  playbackUrl?: string
  initialDurationMs?: number
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

export const usePlayback = ({
  playbackUrl,
  initialDurationMs,
}: UsePlaybackOptions) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)

  const [loadedDurationMs, setLoadedDurationMs] = useState<number>()
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [selectedTimeMs, setSelectedTimeMs] = useState(0)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const [playbackError, setPlaybackError] = useState<string>()

  const previewSeekTimeoutRef = useRef<number | undefined>(undefined)
  const pendingPreviewTimeRef = useRef<number | undefined>(undefined)
  const lastPreviewSeekAtRef = useRef(0)
  const scrubTimeRef = useRef(0)

  const durationMs = loadedDurationMs ?? initialDurationMs ?? 0

  const supportsNativeHls = videoElement
    ? !!(videoElement.canPlayType("application/vnd.apple.mpegurl"))
    : false

  const supportsStreamPlayback =
    !videoElement || supportsNativeHls || Hls.isSupported()
  const error = getPlaybackError({
    playbackError,
    playbackUrl,
    supportsPlayback: supportsStreamPlayback,
  })

  useEffect(() => {
    const video = videoRef.current

    if (!video || !videoElement || !playbackUrl || !supportsStreamPlayback) {
      return
    }

    let hls: Hls | undefined

    if (supportsNativeHls) {
      video.src = playbackUrl
    } else {
      hls = new Hls()
      hls.loadSource(playbackUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
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
  }, [playbackUrl, supportsNativeHls, supportsStreamPlayback, videoElement])

  const clearPreviewSeekTimeout = () => {
    if (!previewSeekTimeoutRef.current) {
      return
    }

    window.clearTimeout(previewSeekTimeoutRef.current)
    previewSeekTimeoutRef.current = undefined
  }

  const updateScrubTime = (timeMs: number) => {
    scrubTimeRef.current = timeMs
    setCurrentTimeMs(timeMs)
    setSelectedTimeMs(timeMs)
  }

  useEffect(() => {
    return () => {
      clearPreviewSeekTimeout()
    }
  }, [])

  const updatePlaybackTime = (timeMs: number) => {
    const nextTimeMs = clampTimeMs(timeMs, durationMs)

    if (isSeeking) {
      return
    }

    scrubTimeRef.current = nextTimeMs
    setCurrentTimeMs(nextTimeMs)
    setSelectedTimeMs(nextTimeMs)
  }

  const updateLoadedDuration = (video: HTMLVideoElement) => {
    const nextDurationMs = getVideoDurationMs(video)

    if (nextDurationMs) {
      setLoadedDurationMs(nextDurationMs)
    }
  }

  const seekToTime = useCallback(
    (timeMs: number) => {
      const nextTimeMs = clampTimeMs(timeMs, durationMs)

      updateScrubTime(nextTimeMs)

      const video = videoRef.current

      if (video) {
        video.currentTime = msToSeconds(nextTimeMs)
      }
    },
    [durationMs]
  )

  const applyPreviewSeek = () => {
    clearPreviewSeekTimeout()

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

    if (previewSeekTimeoutRef.current) {
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

    updateLoadedDuration(video)
    updatePlaybackTime(secondsToMs(video.currentTime))
    setIsReady(true)
    setPlaybackError(undefined)
  }

  const handleDurationChange = () => {
    const video = videoRef.current

    if (!video) {
      return
    }

    updateLoadedDuration(video)
  }

  const handleTimeUpdate = () => {
    const video = videoRef.current

    if (!video) {
      return
    }

    updatePlaybackTime(secondsToMs(video.currentTime))
  }

  const handlePlaybackError = () => {
    setPlaybackError("Unable to play this media stream")
  }

  const startScrub = () => {
    setIsSeeking(true)
  }

  const updateScrub = (timeMs: number) => {
    const nextTimeMs = clampTimeMs(timeMs, durationMs)

    setIsSeeking(true)
    updateScrubTime(nextTimeMs)
    queuePreviewSeek(nextTimeMs)
  }

  const finishScrub = () => {
    clearPreviewSeekTimeout()
    pendingPreviewTimeRef.current = undefined
    seekToTime(scrubTimeRef.current)
    setIsSeeking(false)
  }

  const togglePlayback = async () => {
    const video = videoRef.current

    if (!video) {
      return
    }

    if (video.paused) {
      try {
        await video.play()
        setPlaybackError(undefined)
      } catch {
        setPlaybackError("Unable to start playback")
      }

      return
    }

    video.pause()
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
    playbackUrl,
    selectedTimeMs,
    setVideoRef,
    handleDurationChange,
    handleLoadedMetadata,
    handlePlaybackError,
    handleScrubChange: updateScrub,
    handleScrubEnd: finishScrub,
    handleScrubStart: startScrub,
    handleTimeUpdate,
    seekToTime,
    setIsPlaying,
    togglePlayback,
  }
}
