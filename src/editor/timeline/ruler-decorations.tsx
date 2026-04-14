import type { Marker } from "../types"

import {
  durationToPx,
  MARKER_DURATION_MS,
  clampToTimeline,
  timeToPx,
  timeToPercent,
} from "./shared"

export type DecorationRange = {
  startMs: number
  endMs: number
  mode: "auto" | "ab"
}

const getAbBarPaddingMs = (minorTickMs: number) => minorTickMs / 4
const AB_EDGE_TICK_GAP_PX = 18
const AB_BAR_OFFSET_PX = 2

const getRangeLayout = ({
  startMs,
  endMs,
  timelineLengthMs,
  contentWidthPx,
}: {
  startMs: number
  endMs: number
  timelineLengthMs: number
  contentWidthPx: number
}) => {
  const leftPercent = timeToPercent(startMs, timelineLengthMs)
  const widthPercent = timeToPercent(endMs - startMs, timelineLengthMs)

  return {
    leftPercent,
    widthPercent,
    widthPx: durationToPx(endMs - startMs, timelineLengthMs, contentWidthPx),
  }
}

const getAbVisualEdges = ({
  range,
  minorTickMs,
  timelineLengthMs,
  contentWidthPx,
}: {
  range: DecorationRange
  minorTickMs: number
  timelineLengthMs: number
  contentWidthPx: number
}) => {
  const barPaddingPx = durationToPx(
    getAbBarPaddingMs(minorTickMs),
    timelineLengthMs,
    contentWidthPx
  )

  return {
    startPx:
      timeToPx(range.startMs, timelineLengthMs, contentWidthPx) -
      barPaddingPx +
      AB_BAR_OFFSET_PX,
    endPx:
      timeToPx(range.endMs, timelineLengthMs, contentWidthPx) +
      barPaddingPx +
      AB_BAR_OFFSET_PX,
  }
}

export const getDecorationRanges = (
  markers: Marker[],
  timelineDurationMs: number
): DecorationRange[] => {
  return markers
    .filter((m) => m.selectionMode !== "static")
    .map((m) => ({
      startMs: clampToTimeline(m.requestedTimeMs, timelineDurationMs),
      endMs: clampToTimeline(
        m.requestedTimeMs + MARKER_DURATION_MS,
        timelineDurationMs
      ),
      mode: m.selectionMode as "auto" | "ab",
    }))
    .filter((range) => range.endMs > range.startMs)
}

export const isTickHidden = (
  timeMs: number,
  ranges: DecorationRange[],
  minorTickMs: number,
  timelineLengthMs: number,
  contentWidthPx: number
): boolean => {
  const tickPx = timeToPx(timeMs, timelineLengthMs, contentWidthPx)

  return ranges.some((range) => {
    if (timeMs > range.startMs && timeMs < range.endMs) {
      return true
    }

    if (range.mode !== "ab") {
      return false
    }

    const { startPx, endPx } = getAbVisualEdges({
      range,
      minorTickMs,
      timelineLengthMs,
      contentWidthPx,
    })

    if (
      tickPx <= startPx &&
      startPx - tickPx <= AB_EDGE_TICK_GAP_PX
    ) {
      return true
    }

    return tickPx >= endPx && tickPx - endPx <= AB_EDGE_TICK_GAP_PX
  })
}

const MIN_CHEVRON_COUNT = 2
const CHEVRON_TARGET_SPACING_PX = 18
const CHEVRON_WIDTH_BIAS_PX = 4

const getChevronCount = (rangeWidthPx: number): number => {
  if (rangeWidthPx <= 0) {
    return MIN_CHEVRON_COUNT
  }

  return Math.max(
    MIN_CHEVRON_COUNT,
    Math.ceil((rangeWidthPx + CHEVRON_WIDTH_BIAS_PX) / CHEVRON_TARGET_SPACING_PX)
  )
}

export const RulerDecoration = ({
  range,
  timelineLengthMs,
  contentWidthPx,
  minorTickMs,
}: {
  range: DecorationRange
  timelineLengthMs: number
  contentWidthPx: number
  minorTickMs: number
}) => {
  const layout = getRangeLayout({
    startMs: range.startMs,
    endMs: range.endMs,
    timelineLengthMs,
    contentWidthPx,
  })

  if (range.mode === "ab") {
    return (
      <BarDecoration
        leftPercent={layout.leftPercent}
        widthPercent={layout.widthPercent}
        minorTickMs={minorTickMs}
        timelineLengthMs={timelineLengthMs}
        contentWidthPx={contentWidthPx}
      />
    )
  }

  return (
    <ChevronDecoration
      leftPercent={layout.leftPercent}
      widthPercent={layout.widthPercent}
      count={getChevronCount(layout.widthPx)}
    />
  )
}

const BarDecoration = ({
  leftPercent,
  widthPercent,
  minorTickMs,
  timelineLengthMs,
  contentWidthPx,
}: {
  leftPercent: number
  widthPercent: number
  minorTickMs: number
  timelineLengthMs: number
  contentWidthPx: number
}) => {
  const visualBufferPercent = timeToPercent(
    getAbBarPaddingMs(minorTickMs),
    timelineLengthMs
  )
  const centerNudgePercent =
    contentWidthPx > 0 ? (AB_BAR_OFFSET_PX / contentWidthPx) * 100 : 0
  const adjustedLeftPercent = Math.max(0, leftPercent - visualBufferPercent)
  const adjustedWidthPercent = Math.min(
    100 - adjustedLeftPercent,
    widthPercent + visualBufferPercent * 2
  )

  return (
    <div
      className="absolute top-0 h-2 bg-zinc-300"
      style={{
        left: `${adjustedLeftPercent + centerNudgePercent}%`,
        width: `${adjustedWidthPercent}%`,
      }}
    />
  )
}

const ChevronDecoration = ({
  leftPercent,
  widthPercent,
  count,
}: {
  leftPercent: number
  widthPercent: number
  count: number
}) => (
  <div
    className="absolute top-0 flex h-2.5 items-start justify-evenly"
    style={{
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    }}
  >
    {Array.from({ length: count }, (_, i) => (
      <Chevron key={i} />
    ))}
  </div>
)

const Chevron = () => (
  <svg width="15" height="9" viewBox="0 0 15 9">
    <polygon
      points="0,0 7.5,8 15,0"
      fill="#D9D9D9"
      stroke="#D4D4D8"
      strokeWidth={0.5}
    />
  </svg>
)
