"use client"

import { Pause, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatTimecode } from "@/lib/utils"

type PlayerPanelProps = {
  title: string
  playbackUrl?: string
  currentTimeMs: number
  durationMs: number
  error?: string
  isPlaying: boolean
  isReady: boolean
  setVideoRef: (node: HTMLVideoElement | null) => void
  setIsPlaying: (isPlaying: boolean) => void
  onDurationChange: () => void
  onLoadedMetadata: () => void
  onPlaybackError: () => void
  onTimeUpdate: () => void
  onTogglePlayback: () => void | Promise<void>
}

export const PlayerPanel = ({
  title,
  playbackUrl,
  currentTimeMs,
  durationMs,
  error,
  isPlaying,
  isReady,
  setVideoRef,
  setIsPlaying,
  onDurationChange,
  onLoadedMetadata,
  onPlaybackError,
  onTimeUpdate,
  onTogglePlayback,
}: PlayerPanelProps) => {
  const statusLabel = error
    ? "Error"
    : !playbackUrl
      ? "Unavailable"
      : isReady
        ? "Ready"
        : "Loading"

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-zinc-900">Preview player</h2>
        </div>
        <span className="text-xs text-zinc-500">{statusLabel}</span>
      </div>

      <div className="overflow-hidden rounded-xl bg-zinc-950">
        {playbackUrl ? (
          <video
            ref={setVideoRef}
            className="aspect-video w-full bg-black"
            playsInline
            preload="metadata"
            onDurationChange={onDurationChange}
            onError={onPlaybackError}
            onLoadedMetadata={onLoadedMetadata}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onTimeUpdate={onTimeUpdate}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center px-8 text-center text-sm text-zinc-400">
            Main media playback is unavailable for this episode.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <Button
          size="lg"
          onClick={onTogglePlayback}
          disabled={!playbackUrl || Boolean(error)}
        >
          {isPlaying ? <Pause /> : <Play />}
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <div className="flex items-center gap-3 text-sm tabular-nums text-zinc-600">
          <span>{formatTimecode(currentTimeMs)}</span>
          <span className="text-zinc-300">/</span>
          <span>{formatTimecode(durationMs)}</span>
        </div>
      </div>

      <div className="flex min-h-5 items-center text-xs text-zinc-500">
        {error ? <span className="text-red-600">{error}</span> : <span>{title}</span>}
      </div>
    </section>
  )
}
