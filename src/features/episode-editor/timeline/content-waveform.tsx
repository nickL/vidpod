import type { CSSProperties } from "react"

import type { MediaWaveform, MediaWaveformStatus } from "../types"

import { durationToPx, getTimelineUsableWidthPx } from "./shared"

const BAR_STEP_PX = 8
const BAR_STROKE_WIDTH_PX = 2.8
const WAVEFORM_HEIGHT_PX = 85
const MAX_BAR_HEIGHT_PX = 78
const MIN_BAR_HEIGHT_PX = 4
const BAR_STROKE = "rgba(255,255,255,0.34)"

const GHOST_BARS_PER_PERIOD = 28
const GHOST_PERIOD_PX = BAR_STEP_PX * GHOST_BARS_PER_PERIOD
const GHOST_BASE_HEIGHT_PX = 16
const GHOST_AMPLITUDE_PX = 32
const GHOST_BAR_STROKE = "rgba(255,255,255,0.18)"

export type WaveformBar = {
  heightPx: number
  xPx: number
}

type ContentWaveformProps = {
  contentWidthPx: number
  segmentEndMs: number
  segmentStartMs: number
  timelineDurationMs: number
  waveformBars?: WaveformBar[]
  waveformStatus: MediaWaveformStatus
}

export const ContentWaveform = ({
  contentWidthPx,
  segmentEndMs,
  segmentStartMs,
  timelineDurationMs,
  waveformBars,
  waveformStatus,
}: ContentWaveformProps) => {
  const usableTrackWidthPx = getTimelineUsableWidthPx(contentWidthPx)

  if (usableTrackWidthPx <= 0 || segmentEndMs <= segmentStartMs) {
    return null
  }

  const viewBoxWidth = Math.max(usableTrackWidthPx, 1)
  const segmentOffsetPx = durationToPx(
    segmentStartMs,
    timelineDurationMs,
    contentWidthPx
  )

  const isReady =
    waveformStatus === "ready" && waveformBars && waveformBars.length > 0

  if (!isReady) {
    return (
      <GhostWaveform
        segmentOffsetPx={segmentOffsetPx}
        usableTrackWidthPx={usableTrackWidthPx}
        viewBoxWidth={viewBoxWidth}
      />
    )
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute bottom-0"
        style={{
          left: -segmentOffsetPx,
          width: usableTrackWidthPx,
        }}
      >
        <svg
          className="h-[85px] w-full"
          viewBox={`0 0 ${viewBoxWidth} ${WAVEFORM_HEIGHT_PX}`}
          preserveAspectRatio="none"
          shapeRendering="geometricPrecision"
        >
          {waveformBars.map((bar) => {
            return (
              <line
                key={bar.xPx}
                x1={bar.xPx}
                y1={WAVEFORM_HEIGHT_PX - bar.heightPx}
                x2={bar.xPx}
                y2={WAVEFORM_HEIGHT_PX}
                stroke={BAR_STROKE}
                strokeLinecap="round"
                strokeWidth={BAR_STROKE_WIDTH_PX}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>
      </div>
    </div>
  )
}

const GhostWaveform = ({
  segmentOffsetPx,
  usableTrackWidthPx,
  viewBoxWidth,
}: {
  segmentOffsetPx: number
  usableTrackWidthPx: number
  viewBoxWidth: number
}) => {
  const ghostBars = buildGhostBars(usableTrackWidthPx + GHOST_PERIOD_PX)

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="animate-ghost-waveform absolute bottom-0"
        style={
          {
            left: -segmentOffsetPx,
            width: usableTrackWidthPx,
            "--waveform-phase-drift-px": `-${GHOST_PERIOD_PX}px`,
          } as CSSProperties
        }
      >
        <svg
          className="h-[85px]"
          width={usableTrackWidthPx + GHOST_PERIOD_PX}
          height={WAVEFORM_HEIGHT_PX}
          viewBox={`0 0 ${viewBoxWidth + GHOST_PERIOD_PX} ${WAVEFORM_HEIGHT_PX}`}
          preserveAspectRatio="none"
          shapeRendering="geometricPrecision"
        >
          {ghostBars.map((bar) => (
            <line
              key={bar.xPx}
              x1={bar.xPx}
              y1={WAVEFORM_HEIGHT_PX - bar.heightPx}
              x2={bar.xPx}
              y2={WAVEFORM_HEIGHT_PX}
              stroke={GHOST_BAR_STROKE}
              strokeLinecap="round"
              strokeWidth={BAR_STROKE_WIDTH_PX}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
    </div>
  )
}

const buildGhostBars = (totalWidthPx: number): WaveformBar[] => {
  const count = Math.ceil(totalWidthPx / BAR_STEP_PX)
  return Array.from({ length: count }, (_, index) => {
    const phase = (index / GHOST_BARS_PER_PERIOD) * Math.PI * 2
    const heightPx =
      GHOST_BASE_HEIGHT_PX + ((Math.sin(phase) + 1) / 2) * GHOST_AMPLITUDE_PX
    return {
      xPx: index * BAR_STEP_PX + BAR_STROKE_WIDTH_PX / 2,
      heightPx,
    }
  })
}

export const buildTimelineWaveformBars = ({
  contentWidthPx,
  timelineDurationMs,
  waveform,
}: {
  contentWidthPx: number
  timelineDurationMs: number
  waveform?: MediaWaveform
}) => {
  if (
    !waveform ||
    waveform.status !== "ready" ||
    !waveform.peaks ||
    waveform.peaks.length === 0 ||
    timelineDurationMs <= 0
  ) {
    return undefined
  }

  const usableTrackWidthPx = getTimelineUsableWidthPx(contentWidthPx)

  if (usableTrackWidthPx <= 0) {
    return undefined
  }

  const desiredBarCount = Math.max(
    1,
    Math.floor(usableTrackWidthPx / BAR_STEP_PX) + 1
  )
  const sampledPeaks = resamplePeaks(waveform.peaks, desiredBarCount)

  return sampledPeaks.map((peak, index) => {
    if (peak <= 0) {
      return {
        heightPx: 0,
        xPx: index * BAR_STEP_PX + BAR_STROKE_WIDTH_PX / 2,
      }
    }

    return {
      heightPx: Math.max(
        MIN_BAR_HEIGHT_PX,
        Math.round((peak / 1000) * MAX_BAR_HEIGHT_PX)
      ),
      xPx: index * BAR_STEP_PX + BAR_STROKE_WIDTH_PX / 2,
    }
  })
}

const resamplePeaks = (peaks: number[], nextCount: number) => {
  if (nextCount >= peaks.length) {
    return peaks
  }

  return Array.from({ length: nextCount }, (_, index) => {
    const start = Math.floor((index / nextCount) * peaks.length)
    const end = Math.max(start + 1, Math.floor(((index + 1) / nextCount) * peaks.length))
    let peak = 0

    for (let sampleIndex = start; sampleIndex < end && sampleIndex < peaks.length; sampleIndex += 1) {
      peak = Math.max(peak, peaks[sampleIndex] ?? 0)
    }

    return peak
  })
}
