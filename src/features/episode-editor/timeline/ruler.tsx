import { useMemo } from "react"

import { formatTimecode } from "@/lib/utils"

import type { Marker } from "../types"

import {
  getDecorationRanges,
  isTickHidden,
  RulerDecoration,
} from "./ruler-decorations"
import type { RulerScale } from "./shared"

type RulerProps = {
  timelineLengthMs: number
  markers: Marker[]
  contentWidthPx: number
  rulerScale: RulerScale | null
}

export const Ruler = ({
  timelineLengthMs,
  contentWidthPx,
  markers,
  rulerScale,
}: RulerProps) => {
  const decorationRanges = useMemo(
    () => getDecorationRanges(markers, timelineLengthMs),
    [markers, timelineLengthMs]
  )

  const { majorTicks, minorTicks, minorTickMs } = useMemo(
    () => buildRulerTicks(timelineLengthMs, rulerScale),
    [timelineLengthMs, rulerScale]
  )
  const labels = useMemo(
    () => buildRulerLabels(majorTicks, contentWidthPx),
    [majorTicks, contentWidthPx]
  )

  return (
    <div className="relative h-14 px-2">
      <div className="relative h-full">
        {majorTicks.map((tick) => (
          <div
            key={`major-${tick.timeMs}`}
            className="absolute top-0 bottom-0 w-px bg-zinc-300"
            style={{ left: `${tick.percent}%` }}
          />
        ))}

        {minorTicks.map((tick) => {
          const isHidden = isTickHidden(
            tick.timeMs,
            decorationRanges,
            minorTickMs,
            timelineLengthMs,
            contentWidthPx
          )

          if (isHidden) {
            return null
          }

          return (
            <div
              key={`minor-${tick.timeMs}`}
              className="absolute top-0 h-2 w-px bg-zinc-300"
              style={{ left: `${tick.percent}%` }}
            />
          )
        })}

        {labels.map((label) => (
          <span
            key={`label-${label.timeMs}`}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-normal tabular-nums text-zinc-500"
            style={{ left: `${label.centerPercent}%` }}
          >
            {label.text}
          </span>
        ))}

        {decorationRanges.map((range) => (
          <RulerDecoration
            key={`decoration-${range.startMs}`}
            range={range}
            timelineLengthMs={timelineLengthMs}
            contentWidthPx={contentWidthPx}
            minorTickMs={minorTickMs}
          />
        ))}
      </div>
    </div>
  )
}

type RulerTick = {
  timeMs: number
  percent: number
}

type RulerLabel = {
  timeMs: number
  text: string
  centerPercent: number
}

const LABEL_WIDTH_PX = 62
const LABEL_GAP_PX = 8

const buildRulerTicks = (
  timelineLengthMs: number,
  rulerScale: RulerScale | null
) => {
  if (timelineLengthMs <= 0 || !rulerScale) {
    return { majorTicks: [], minorTicks: [], minorTickMs: 1_000 }
  }

  const { majorTickMs, minorTickMs } = rulerScale

  const majorTicks = buildTicksForStep(timelineLengthMs, majorTickMs)
  const minorTicks = buildTicksForStep(timelineLengthMs, minorTickMs).filter(
    (tick) => tick.timeMs % majorTickMs !== 0
  )

  return { majorTicks, minorTicks, minorTickMs }
}

const buildTicksForStep = (
  timelineLengthMs: number,
  intervalMs: number
): RulerTick[] => {
  const result: RulerTick[] = []

  for (let timeMs = 0; timeMs <= timelineLengthMs; timeMs += intervalMs) {
    result.push({ timeMs, percent: (timeMs / timelineLengthMs) * 100 })
  }

  if (result.at(-1)?.timeMs !== timelineLengthMs) {
    result.push({
      timeMs: timelineLengthMs,
      percent: 100,
    })
  }

  return result
}

const buildRulerLabels = (
  majorTicks: RulerTick[],
  contentWidthPx: number
) => {
  const labels: RulerLabel[] = []
  let previousRightPx = -Infinity;

  for (let index = 0; index < majorTicks.length - 1; index += 1) {
    const tick = majorTicks[index]
    const nextTick = majorTicks[index + 1]
    const centerPercent = (tick.percent + nextTick.percent) / 2
    const centerPx = (centerPercent / 100) * contentWidthPx
    const leftPx = centerPx - LABEL_WIDTH_PX / 2
    const rightPx = leftPx + LABEL_WIDTH_PX

    if (leftPx < previousRightPx + LABEL_GAP_PX) {
      continue
    }

    labels.push({
      timeMs: tick.timeMs,
      text: formatTimecode(tick.timeMs),
      centerPercent,
    })
    previousRightPx = rightPx
  }

  return labels
}
