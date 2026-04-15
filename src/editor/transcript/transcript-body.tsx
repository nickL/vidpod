"use client"

import { Fragment, useEffect, useMemo, useRef } from "react"

import { cn, formatTimecode } from "@/lib/utils"

import type { TranscriptSegment, TranscriptWord } from "./types"

type TranscriptBodyProps = {
  segments: TranscriptSegment[]
  currentTimeMs: number
  onSeek: (timeMs: number) => void
}

type WordIndexEntry = {
  segmentIndex: number
  wordIndex: number
  startMs: number
}

type ActivePosition = {
  segmentIndex: number
  wordIndex: number
}

const buildWordIndex = (segments: TranscriptSegment[]): WordIndexEntry[] =>
  segments.flatMap((segment, segmentIndex) =>
    segment.words.map((word, wordIndex) => ({
      segmentIndex,
      wordIndex,
      startMs: word.startMs,
    }))
  )

const findActivePosition = (
  wordIndex: WordIndexEntry[],
  currentTimeMs: number
): ActivePosition | undefined => {
  if (wordIndex.length === 0 || wordIndex[0].startMs > currentTimeMs) {
    return undefined
  }

  let lo = 0
  let hi = wordIndex.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1
    if (wordIndex[mid].startMs <= currentTimeMs) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }

  const entry = wordIndex[lo]
  return { segmentIndex: entry.segmentIndex, wordIndex: entry.wordIndex }
}

const manropeStyle = { fontFamily: "var(--font-manrope)" }

export const TranscriptBody = ({
  segments,
  currentTimeMs,
  onSeek,
}: TranscriptBodyProps) => {
  const wordIndex = useMemo(() => buildWordIndex(segments), [segments])
  const activePosition = useMemo(
    () => findActivePosition(wordIndex, currentTimeMs),
    [wordIndex, currentTimeMs]
  )
  const activeSegmentIndex = activePosition?.segmentIndex
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const segmentRefs = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    if (activeSegmentIndex === undefined) {
      return
    }

    const container = scrollRef.current
    const activeSegmentEl = segmentRefs.current[activeSegmentIndex]

    if (!container || !activeSegmentEl) {
      return
    }

    const segmentRect = activeSegmentEl.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const segmentTopInContainer =
      segmentRect.top - containerRect.top + container.scrollTop
    const targetScrollTop =
      segmentTopInContainer -
      container.clientHeight / 2 +
      segmentRect.height / 2
    container.scrollTo({ top: Math.max(targetScrollTop, 0), behavior: "smooth" })
  }, [activeSegmentIndex])

  return (
    <div
      ref={scrollRef}
      className="max-h-120 overflow-y-auto"
      style={manropeStyle}
    >
      <div className="mx-auto flex max-w-[640px] flex-col gap-8 py-2">
        {segments.map((segment, segmentIndex) => {
          const isActive = activePosition?.segmentIndex === segmentIndex
          const isPast =
            activePosition !== undefined &&
            segmentIndex < activePosition.segmentIndex
          const activeWordIndex = isActive ? activePosition?.wordIndex : undefined

          return (
            <div
              key={segment.id}
              ref={(node) => {
                segmentRefs.current[segmentIndex] = node
              }}
            >
              <SegmentRow
                segment={segment}
                activeWordIndex={activeWordIndex}
                isPast={isPast}
                isActive={isActive}
                onSeek={onSeek}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const SegmentRow = ({
  segment,
  activeWordIndex,
  isPast,
  isActive,
  onSeek,
}: {
  segment: TranscriptSegment
  activeWordIndex?: number
  isPast: boolean
  isActive: boolean
  onSeek: (timeMs: number) => void
}) => {
  const textColor = isPast
    ? "text-zinc-400"
    : isActive
      ? "text-zinc-900"
      : "text-zinc-600"

  return (
    <div className="flex items-start gap-4">
      <button
        type="button"
        onClick={() => onSeek(segment.startMs)}
        className="mt-0.5 font-mono text-xs tabular-nums text-zinc-500 hover:text-zinc-800"
      >
        {formatTimecode(segment.startMs)}
      </button>
      <p className={cn("min-w-0 flex-1 text-base leading-relaxed", textColor)}>
        {segment.words.map((word, wordIndex) => (
          <Fragment key={wordIndex}>
            {wordIndex > 0 ? " " : null}
            <Word
              word={word}
              isActive={activeWordIndex === wordIndex}
              onSeek={onSeek}
            />
          </Fragment>
        ))}
      </p>
    </div>
  )
}

const Word = ({
  word,
  isActive,
  onSeek,
}: {
  word: TranscriptWord
  isActive: boolean
  onSeek: (timeMs: number) => void
}) => {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => onSeek(word.startMs)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSeek(word.startMs)
        }
      }}
      className={cn(
        "cursor-pointer rounded-sm px-0.5 transition-colors hover:bg-zinc-100",
        isActive && "bg-fuchsia-200 text-zinc-950 hover:bg-fuchsia-200"
      )}
    >
      {word.text}
    </span>
  )
}
