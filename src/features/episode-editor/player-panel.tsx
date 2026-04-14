"use client"

import { useCallback, useEffect, useRef, type ChangeEvent } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  RiAddLine,
  RiContractLeftFill,
  RiContractRightFill,
  RiHistoryFill,
  RiPauseFill,
  RiPlayFill,
  RiRewindMiniFill,
  RiSpeedMiniFill,
} from "react-icons/ri"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { duration } from "@/lib/animation"
import { cn } from "@/lib/utils"

import type { EpisodeVideoAsset, UploadProgressState } from "./types"

const SKIP_INTERVAL_MS = 10_000
const JUMP_INTERVAL_MS = 30_000
const HOLD_START_MS = 400
const HOLD_REPEAT_MS = 150

const transportButtonClasses =
  "appearance-none bg-transparent p-0 transition-all duration-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:opacity-70 enabled:active:scale-95"

type PlayerPanelProps = {
  playbackUrl?: string
  error?: string
  isPlaying: boolean
  replacementEpisodeVideo?: EpisodeVideoAsset
  uploadError?: string
  videoUploadProgress?: UploadProgressState
  canPreviewHls: boolean
  isPreparingPreview: boolean
  setVideoRef: (node: HTMLVideoElement | null) => void
  onDurationChange: () => void
  onLoadedMetadata: () => void
  onPlaybackError: () => void
  onVideoEnded: () => void
  onTimeUpdate: () => void
  onVideoPlay: () => void
  onVideoPause: () => void
  onJumpBy: (deltaMs: number) => void
  onSeekToStart: () => void
  onSeekToEnd: () => void
  onTogglePlayback: () => void | Promise<void>
  onPreviewHls: () => void | Promise<void>
  onAddEpisodeVideo: (file: File) => void | Promise<void>
  onRemoveEpisodeVideo: (episodeVideoAssetId: string) => void | Promise<void>
  onUseEpisodeVideo: (episodeVideoAssetId: string) => void | Promise<void>
}

export const PlayerPanel = ({
  playbackUrl,
  error,
  isPlaying,
  replacementEpisodeVideo,
  uploadError,
  videoUploadProgress,
  canPreviewHls,
  isPreparingPreview,
  setVideoRef,
  onDurationChange,
  onLoadedMetadata,
  onPlaybackError,
  onVideoEnded,
  onTimeUpdate,
  onVideoPlay,
  onVideoPause,
  onJumpBy,
  onSeekToStart,
  onSeekToEnd,
  onTogglePlayback,
  onPreviewHls,
  onAddEpisodeVideo,
  onRemoveEpisodeVideo,
  onUseEpisodeVideo,
}: PlayerPanelProps) => {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const transportDisabled = !playbackUrl || Boolean(error)
  const isEpisodeUploadActive =
    replacementEpisodeVideo?.mediaAsset.status === "uploading" ||
    replacementEpisodeVideo?.mediaAsset.status === "processing"
  const skipBack = () => onJumpBy(-SKIP_INTERVAL_MS)
  const skipForward = () => onJumpBy(SKIP_INTERVAL_MS)
  const rewind = () => onJumpBy(-JUMP_INTERVAL_MS)
  const fastForward = () => onJumpBy(JUMP_INTERVAL_MS)
  const handleAddVideoClick = () => {
    uploadInputRef.current?.click()
  }
  const handleVideoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]

    event.currentTarget.value = ""

    if (!file) {
      return
    }

    void onAddEpisodeVideo(file)
  }

  return (
    <section className="@container flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-8">
      <div className="flex items-center justify-end gap-2">
        <input
          ref={uploadInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleVideoFileChange}
        />
        {canPreviewHls ? (
          <Button
            variant="outline"
            disabled={!playbackUrl || isPreparingPreview}
            onClick={() => void onPreviewHls()}
          >
            {isPreparingPreview ? "Preparing HLS…" : "Preview HLS"}
          </Button>
        ) : null}
        <Button
          disabled={isEpisodeUploadActive}
          onClick={handleAddVideoClick}
        >
          <RiAddLine />
          Add new video
        </Button>
      </div>
      {uploadError ? (
        <p className="text-sm text-red-600">{uploadError}</p>
      ) : null}
      <div className="overflow-hidden rounded-xl bg-zinc-950">
        {playbackUrl ? (
          <video
            ref={setVideoRef}
            className="aspect-video w-full bg-black"
            playsInline
            preload="metadata"
            onDurationChange={onDurationChange}
            onEnded={onVideoEnded}
            onError={onPlaybackError}
            onLoadedMetadata={onLoadedMetadata}
            onPause={onVideoPause}
            onPlay={onVideoPlay}
            onTimeUpdate={onTimeUpdate}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center px-8 text-center text-sm text-zinc-400">
            Main media playback is unavailable for this episode.
          </div>
        )}
      </div>

      {replacementEpisodeVideo ? (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <EpisodeVideoCandidate
            episodeVideoAsset={replacementEpisodeVideo}
            uploadProgress={videoUploadProgress}
            onRemove={() => onRemoveEpisodeVideo(replacementEpisodeVideo.id)}
            onUse={() => onUseEpisodeVideo(replacementEpisodeVideo.id)}
          />
        </div>
      ) : null}

      <TransportControls
        isPlaying={isPlaying}
        disabled={transportDisabled}
        onJumpToStart={onSeekToStart}
        onSkipBack={skipBack}
        onRewind={rewind}
        onTogglePlayback={onTogglePlayback}
        onFastForward={fastForward}
        onSkipForward={skipForward}
        onJumpToEnd={onSeekToEnd}
      />
    </section>
  )
}

const EpisodeVideoCandidate = ({
  episodeVideoAsset,
  uploadProgress,
  onRemove,
  onUse,
}: {
  episodeVideoAsset: EpisodeVideoAsset
  uploadProgress?: UploadProgressState
  onRemove: () => void | Promise<void>
  onUse: () => void | Promise<void>
}) => {
  const isReady = episodeVideoAsset.mediaAsset.status === "ready"
  const canDiscard =
    episodeVideoAsset.mediaAsset.status === "ready" ||
    episodeVideoAsset.mediaAsset.status === "failed"
  const statusLabel = uploadProgress
    ? uploadProgress.phase === "uploading"
      ? "Uploading"
      : "Processing"
    : episodeVideoAsset.mediaAsset.status === "failed"
      ? "Failed"
      : episodeVideoAsset.mediaAsset.status === "processing"
        ? "Processing"
        : episodeVideoAsset.mediaAsset.status === "uploading"
          ? "Uploading"
          : "Ready"

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-medium text-zinc-900">
            {episodeVideoAsset.title}
          </span>
          <span className="text-xs text-zinc-500">{statusLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {canDiscard ? (
            <Button variant="ghost" size="sm" onClick={onRemove}>
              Cancel
            </Button>
          ) : null}
          {isReady ? (
            <Button variant="outline" size="sm" onClick={onUse}>
              Use new video
            </Button>
          ) : null}
        </div>
      </div>

      {uploadProgress ? (
        <Progress value={uploadProgress.progressPercent} />
      ) : null}
    </div>
  )
}

type TransportControlsProps = {
  isPlaying: boolean
  disabled: boolean
  onJumpToStart: () => void
  onSkipBack: () => void
  onRewind: () => void
  onTogglePlayback: () => void | Promise<void>
  onFastForward: () => void
  onSkipForward: () => void
  onJumpToEnd: () => void
}

const TransportControls = ({
  isPlaying,
  disabled,
  onJumpToStart,
  onSkipBack,
  onRewind,
  onTogglePlayback,
  onFastForward,
  onSkipForward,
  onJumpToEnd,
}: TransportControlsProps) => {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-200 px-4 py-2 @[26rem]:gap-4 @[26rem]:px-6">
      <JumpToStartButton onClick={onJumpToStart} disabled={disabled} />
      <SkipBackButton onClick={onSkipBack} disabled={disabled} />
      <RewindButton onClick={onRewind} disabled={disabled} />
      <PlayPauseButton
        isPlaying={isPlaying}
        onClick={onTogglePlayback}
        disabled={disabled}
      />
      <FastForwardButton onClick={onFastForward} disabled={disabled} />
      <SkipForwardButton onClick={onSkipForward} disabled={disabled} />
      <JumpToEndButton onClick={onJumpToEnd} disabled={disabled} />
    </div>
  )
}

type TransportButtonProps = {
  onClick: () => void | Promise<void>
  disabled?: boolean
}

const JumpToStartButton = ({ onClick, disabled }: TransportButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label="Jump to start"
    className={cn("flex items-center gap-2", transportButtonClasses)}
  >
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-300">
      <RiContractLeftFill className="size-5 text-zinc-800" />
    </span>
    <span className="hidden whitespace-nowrap text-sm text-zinc-500 min-[1600px]:inline">
      Jump to start
    </span>
  </button>
)

const JumpToEndButton = ({ onClick, disabled }: TransportButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label="Jump to end"
    className={cn("flex items-center gap-2", transportButtonClasses)}
  >
    <span className="hidden whitespace-nowrap text-sm text-zinc-500 min-[1600px]:inline">
      Jump to end
    </span>
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-300">
      <RiContractRightFill className="size-5 text-zinc-800" />
    </span>
  </button>
)

const SkipBackButton = ({ onClick, disabled }: TransportButtonProps) => {
  const holdHandlers = usePressAndHold(onClick)
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="Skip back 10 seconds"
      className={cn("flex items-center gap-2", transportButtonClasses)}
      {...holdHandlers}
    >
      <RiHistoryFill className="size-5 shrink-0 text-zinc-800" />
      <span className="whitespace-nowrap text-sm text-zinc-500">10s</span>
    </button>
  )
}

const SkipForwardButton = ({ onClick, disabled }: TransportButtonProps) => {
  const holdHandlers = usePressAndHold(onClick)
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="Skip forward 10 seconds"
      className={cn("flex items-center gap-2", transportButtonClasses)}
      {...holdHandlers}
    >
      <span className="whitespace-nowrap text-sm text-zinc-500">10s</span>
      <RiHistoryFill className="size-5 shrink-0 -scale-x-100 text-zinc-800" />
    </button>
  )
}

const RewindButton = ({ onClick, disabled }: TransportButtonProps) => {
  const holdHandlers = usePressAndHold(onClick)
  return (
    <button
      type="button"
      disabled={disabled}
      className={transportButtonClasses}
      {...holdHandlers}
    >
      <RiRewindMiniFill className="size-7 text-zinc-900" />
    </button>
  )
}

const FastForwardButton = ({ onClick, disabled }: TransportButtonProps) => {
  const holdHandlers = usePressAndHold(onClick)
  return (
    <button
      type="button"
      disabled={disabled}
      className={transportButtonClasses}
      {...holdHandlers}
    >
      <RiSpeedMiniFill className="size-7 text-zinc-900" />
    </button>
  )
}

type PlayPauseButtonProps = TransportButtonProps & {
  isPlaying: boolean
}

const PlayPauseButton = ({
  isPlaying,
  onClick,
  disabled,
}: PlayPauseButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={transportButtonClasses}
    aria-label={isPlaying ? "Pause" : "Play"}
  >
    <AnimatePresence initial={false} mode="wait">
      <motion.span
        key={isPlaying ? "pause" : "play"}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: duration.fast }}
        className="flex"
      >
        {isPlaying ? (
          <RiPauseFill className="size-12 text-zinc-900" />
        ) : (
          <RiPlayFill className="size-12 text-zinc-900" />
        )}
      </motion.span>
    </AnimatePresence>
  </button>
)

const usePressAndHold = (action: () => void | Promise<void>) => {
  const holdStartRef = useRef<number | undefined>(undefined)
  const holdRepeatRef = useRef<number | undefined>(undefined)
  const pointerFiredRef = useRef(false)

  const stop = useCallback(() => {
    if (holdStartRef.current !== undefined) {
      window.clearTimeout(holdStartRef.current)
      holdStartRef.current = undefined
    }
    if (holdRepeatRef.current !== undefined) {
      window.clearInterval(holdRepeatRef.current)
      holdRepeatRef.current = undefined
    }
  }, [])

  useEffect(() => stop, [stop])

  return {
    onPointerDown: () => {
      pointerFiredRef.current = true
      void action()
      holdStartRef.current = window.setTimeout(() => {
        holdRepeatRef.current = window.setInterval(
          () => void action(),
          HOLD_REPEAT_MS
        )
      }, HOLD_START_MS)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: () => {
      if (pointerFiredRef.current) {
        pointerFiredRef.current = false
        return
      }
      void action()
    },
  }
}
