"use client"

import { motion, AnimatePresence } from "motion/react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

import { getTranscriptPhaseLabel } from "./phases"
import { TranscriptBody } from "./transcript-body"
import type { Transcript } from "./types"

type TranscriptPanelProps = {
  transcript: Transcript
  currentTimeMs: number
  onSeek: (timeMs: number) => void
  onClose: () => void
}

const manropeStyle = { fontFamily: "var(--font-manrope)" }

const IDLE_PERCENT = 5
const TRANSCRIBE_SPAN_PERCENT = 85
const BUILDING_PERCENT = 95

type ChunkProgress = {
  completed: number
  total: number
}

const getChunkProgress = (transcript: Transcript): ChunkProgress | undefined => {
  if (
    transcript.phase !== "transcribing" ||
    typeof transcript.totalChunks !== "number" ||
    transcript.totalChunks <= 0
  ) {
    return undefined
  }

  return {
    completed: transcript.completedChunks ?? 0,
    total: transcript.totalChunks,
  }
}

const getProgressPercent = (transcript: Transcript) => {
  const chunks = getChunkProgress(transcript)

  if (chunks) {
    return IDLE_PERCENT + TRANSCRIBE_SPAN_PERCENT * (chunks.completed / chunks.total)
  }

  if (transcript.phase === "building") {
    return BUILDING_PERCENT
  }

  return IDLE_PERCENT
}

export const TranscriptPanel = ({
  transcript,
  currentTimeMs,
  onSeek,
  onClose,
}: TranscriptPanelProps) => {
  const wordCount = transcript.segments?.reduce(
    (total, segment) => total + segment.words.length,
    0
  )

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-8 min-[1400px]:col-span-2"
    >
      <Header wordCount={wordCount} onClose={onClose} />
      <PanelBody
        transcript={transcript}
        currentTimeMs={currentTimeMs}
        onSeek={onSeek}
      />
    </motion.section>
  )
}

const Header = ({
  wordCount,
  onClose,
}: {
  wordCount?: number
  onClose: () => void
}) => {
  return (
    <div className="flex items-center justify-between gap-4" style={manropeStyle}>
      <div className="flex items-baseline gap-3">
        <h2 className="text-base font-bold text-zinc-800">Transcript</h2>
        {wordCount ? (
          <span className="text-sm font-semibold text-zinc-500">
            {wordCount.toLocaleString()} words
          </span>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close transcript"
        className="size-8 text-zinc-500 hover:text-zinc-900"
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  )
}

const PanelBody = ({
  transcript,
  currentTimeMs,
  onSeek,
}: {
  transcript: Transcript
  currentTimeMs: number
  onSeek: (timeMs: number) => void
}) => {
  if (transcript.status === "ready" && transcript.segments?.length) {
    return (
      <TranscriptBody
        segments={transcript.segments}
        currentTimeMs={currentTimeMs}
        onSeek={onSeek}
      />
    )
  }

  return <ProgressState transcript={transcript} />
}

const ProgressState = ({ transcript }: { transcript: Transcript }) => {
  const label = getTranscriptPhaseLabel(transcript.phase)
  const chunks = getChunkProgress(transcript)
  const percent = getProgressPercent(transcript)

  return (
    <div
      className="flex min-h-[240px] flex-col items-center justify-center gap-5 py-8"
      style={manropeStyle}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="text-sm font-semibold text-zinc-900"
          >
            {label}
          </motion.p>
        </AnimatePresence>
        {chunks ? (
          <p className="text-xs tabular-nums text-zinc-500">
            {chunks.completed} of {chunks.total} chunks
          </p>
        ) : null}
      </div>
      <Progress value={percent} className="w-full max-w-[320px]" />
    </div>
  )
}
