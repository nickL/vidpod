"use client"

import { useCallback, useEffect, useRef, type ChangeEvent } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Download, LoaderCircle } from "lucide-react"
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

import { Button, buttonVariants } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { duration } from "@/lib/animation"
import { capitalize, cn } from "@/lib/utils"

import type { EpisodeVideoAsset, Mp4ExportJob, UploadProgressState } from "../types"

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
  canExportMp4: boolean
  canResetDemo: boolean
  isPreparingPreview: boolean
  isResettingDemo: boolean
  mp4Job?: Mp4ExportJob
  isStartingMp4Export: boolean
  mp4ExportError?: string
  setVideoRef: (node: HTMLVideoElement | null) => void
  onDurationChange: () => void
  onLoadedMetadata: () => void
  onPlaybackError: () => void
  onVideoEnded: () => void
  onTimeUpdate: () => void
  onVideoPlay: () => void
  onVideoPause: () => void
  onJumpBy: (deltaMs: number) => void
  onJumpToStart: () => void
  onJumpToEnd: () => void
  onTogglePlayback: () => void | Promise<void>
  onPreviewHls: () => void | Promise<void>
  onGenerateMp4: () => void | Promise<void>
  onRegenerateMp4: () => void | Promise<void>
  onAddEpisodeVideo: (file: File) => void | Promise<void>
  onResetDemo: () => void | Promise<void>
  onRemoveEpisodeVideo: (episodeVideoAssetId: string) => void | Promise<void>
  onSelectEpisodeVideo: (episodeVideoAssetId: string) => void | Promise<void>
}

const MP4_PROGRESS_PERCENT_BY_PHASE: Record<string, number> = {
  preparing: 15,
  rendering: 60,
  uploading: 90,
}

const IDLE_MP4_PROGRESS_PERCENT = 5

const getMp4ProgressPercent = (job?: Mp4ExportJob) => {
  if (!job) return IDLE_MP4_PROGRESS_PERCENT
  if (job.status === "ready") return 100
  return job.phase
    ? (MP4_PROGRESS_PERCENT_BY_PHASE[job.phase] ?? IDLE_MP4_PROGRESS_PERCENT)
    : IDLE_MP4_PROGRESS_PERCENT
}

export const PlayerPanel = ({
  playbackUrl,
  error,
  isPlaying,
  replacementEpisodeVideo,
  uploadError,
  videoUploadProgress,
  canPreviewHls,
  canExportMp4,
  canResetDemo,
  isPreparingPreview,
  isResettingDemo,
  mp4Job,
  isStartingMp4Export,
  mp4ExportError,
  setVideoRef,
  onDurationChange,
  onLoadedMetadata,
  onPlaybackError,
  onVideoEnded,
  onTimeUpdate,
  onVideoPlay,
  onVideoPause,
  onJumpBy,
  onJumpToStart,
  onJumpToEnd,
  onTogglePlayback,
  onPreviewHls,
  onGenerateMp4,
  onRegenerateMp4,
  onAddEpisodeVideo,
  onResetDemo,
  onRemoveEpisodeVideo,
  onSelectEpisodeVideo,
}: PlayerPanelProps) => {

  
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const transportDisabled = !playbackUrl || !!error
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
      <div className="flex items-center gap-2">
        {canResetDemo ? (
          <Button
            variant="outline"
            disabled={isEpisodeUploadActive || isResettingDemo}
            onClick={() => void onResetDemo()}
          >
            {isResettingDemo ? "Resetting demo…" : "Reset demo"}
          </Button>
        ) : null}
        <input
          ref={uploadInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleVideoFileChange}
        />
        <div className="ml-auto flex items-center gap-2">
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
            variant="outline"
            disabled={isEpisodeUploadActive}
            onClick={handleAddVideoClick}
          >
            <RiAddLine />
            Add new video
          </Button>
          {canExportMp4 ? (
            <Mp4ExportAffordance
              job={mp4Job}
              isStarting={isStartingMp4Export}
              onGenerate={onGenerateMp4}
              onRegenerate={onRegenerateMp4}
            />
          ) : null}
        </div>
      </div>
      {uploadError ? (
        <p className="text-sm text-red-600">{uploadError}</p>
      ) : null}
      <Mp4ExportProgressRow
        job={mp4Job}
        isStarting={isStartingMp4Export}
        error={mp4ExportError}
      />
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
            Error: media playback not unavailable for this video.
          </div>
        )}
      </div>

      {replacementEpisodeVideo ? (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <EpisodeVideoCandidate
            episodeVideoAsset={replacementEpisodeVideo}
            uploadProgress={videoUploadProgress}
            onRemove={() => onRemoveEpisodeVideo(replacementEpisodeVideo.id)}
            onUse={() => onSelectEpisodeVideo(replacementEpisodeVideo.id)}
          />
        </div>
      ) : null}

      <TransportControls
        isPlaying={isPlaying}
        disabled={transportDisabled}
        onJumpToStart={onJumpToStart}
        onSkipBack={skipBack}
        onRewind={rewind}
        onTogglePlayback={onTogglePlayback}
        onFastForward={fastForward}
        onSkipForward={skipForward}
        onJumpToEnd={onJumpToEnd}
      />
    </section>
  )
}

const Mp4ExportAffordance = ({
  job,
  isStarting,
  onGenerate,
  onRegenerate,
}: {
  job?: Mp4ExportJob
  isStarting: boolean
  onGenerate: () => void | Promise<void>
  onRegenerate: () => void | Promise<void>
}) => {
  if (job?.status === "ready" && job.output) {
    return (
      <a
        href={`/api/mp4-export-jobs/${job.id}/download`}
        download
        className={cn(buttonVariants())}
      >
        <Download />
        Download MP4
      </a>
    )
  }

  if (job?.status === "failed") {
    return (
      <Button onClick={() => void onRegenerate()}>
        Retry MP4
      </Button>
    )
  }

  const isGenerating =
    isStarting || job?.status === "queued" || job?.status === "processing"

  return (
    <Button disabled={isGenerating} onClick={() => void onGenerate()}>
      {isGenerating ? (
        <>
          <LoaderCircle className="animate-spin" />
          {isStarting ? "Starting…" : "Generating…"}
        </>
      ) : (
        "Generate MP4"
      )}
    </Button>
  )
}

const Mp4ExportProgressRow = ({
  job,
  isStarting,
  error,
}: {
  job?: Mp4ExportJob
  isStarting: boolean
  error?: string
}) => {
  const isGenerating =
    isStarting || job?.status === "queued" || job?.status === "processing"
  const isVisible = isGenerating || !!error
  const label = error
    ? error
    : job?.progressMessage ?? (isStarting ? "Starting MP4 export…" : "Preparing…")
  const percent = getMp4ProgressPercent(job)

  return (
    <AnimatePresence initial={false}>
      {isVisible ? (
        <motion.div
          key="mp4-progress"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-xs",
                error ? "text-red-600" : "text-zinc-600"
              )}
            >
              {label}
            </span>
            {isGenerating ? (
              <Progress value={percent} className="w-40" />
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
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
  const canDiscard = isReady || episodeVideoAsset.mediaAsset.status === "failed"
  const statusLabel = capitalize(uploadProgress?.phase ?? episodeVideoAsset.mediaAsset.status)

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
      <JumpToEdgeButton direction="start" onClick={onJumpToStart} disabled={disabled} />
      <SkipButton       direction="back"  onClick={onSkipBack}    disabled={disabled} />
      <LongJumpButton   direction="back"  onClick={onRewind}      disabled={disabled} />
      <PlayPauseButton
        isPlaying={isPlaying}
        onClick={onTogglePlayback}
        disabled={disabled}
      />
      <LongJumpButton   direction="forward" onClick={onFastForward} disabled={disabled} />
      <SkipButton       direction="forward" onClick={onSkipForward} disabled={disabled} />
      <JumpToEdgeButton direction="end"     onClick={onJumpToEnd}   disabled={disabled} />
    </div>
  )
}

type TransportButtonProps = {
  onClick: () => void | Promise<void>
  disabled?: boolean
}

const JumpToEdgeButton = ({
  direction,
  onClick,
  disabled,
}: TransportButtonProps & { direction: "start" | "end" }) => {
  const isStart = direction === "start"
  const Icon = isStart ? RiContractLeftFill : RiContractRightFill
  const label = isStart ? "Jump to start" : "Jump to end"
  const iconNode = (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-300">
      <Icon className="size-5 text-zinc-800" />
    </span>
  )
  const labelNode = (
    <span className="hidden whitespace-nowrap text-sm text-zinc-500 min-[1600px]:inline">
      {label}
    </span>
  )
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn("flex items-center gap-2", transportButtonClasses)}
    >
      {isStart ? iconNode : labelNode}
      {isStart ? labelNode : iconNode}
    </button>
  )
}

const SkipButton = ({
  direction,
  onClick,
  disabled,
}: TransportButtonProps & { direction: "back" | "forward" }) => {
  const holdHandlers = usePressAndHold(onClick)
  const isBack = direction === "back"
  const iconNode = (
    <RiHistoryFill className={cn("size-5 shrink-0 text-zinc-800", !isBack && "-scale-x-100")} />
  )
  const labelNode = <span className="whitespace-nowrap text-sm text-zinc-500">10s</span>
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={isBack ? "Skip back 10 seconds" : "Skip forward 10 seconds"}
      className={cn("flex items-center gap-2", transportButtonClasses)}
      {...holdHandlers}
    >
      {isBack ? iconNode : labelNode}
      {isBack ? labelNode : iconNode}
    </button>
  )
}

const LongJumpButton = ({
  direction,
  onClick,
  disabled,
}: TransportButtonProps & { direction: "back" | "forward" }) => {
  const holdHandlers = usePressAndHold(onClick)
  const Icon = direction === "back" ? RiRewindMiniFill : RiSpeedMiniFill
  return (
    <button
      type="button"
      disabled={disabled}
      className={transportButtonClasses}
      {...holdHandlers}
    >
      <Icon className="size-7 text-zinc-900" />
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
      // skip the trailing click - pointerdown already fired.
      if (pointerFiredRef.current) {
        pointerFiredRef.current = false
        return
      }
      void action()
    },
  }
}
