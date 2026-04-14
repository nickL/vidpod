export const MARKER_DURATION_MS = 30_000
export const CONTENT_HORIZONTAL_INSET_PX = 8
const SECOND_MS = 1_000
const MINUTE_MS = 60 * SECOND_MS

export type RulerScale = {
  majorTickMs: number
  minorTickMs: number
}

const RULER_SCALE_PRESETS: RulerScale[] = [
  { majorTickMs: 1 * SECOND_MS, minorTickMs: 200 },
  { majorTickMs: 2 * SECOND_MS, minorTickMs: 500 },
  { majorTickMs: 5 * SECOND_MS, minorTickMs: 1 * SECOND_MS },
  { majorTickMs: 10 * SECOND_MS, minorTickMs: 2 * SECOND_MS },
  { majorTickMs: 15 * SECOND_MS, minorTickMs: 5 * SECOND_MS },
  { majorTickMs: 30 * SECOND_MS, minorTickMs: 5 * SECOND_MS },
  { majorTickMs: 1 * MINUTE_MS, minorTickMs: 10 * SECOND_MS },
  { majorTickMs: 2 * MINUTE_MS, minorTickMs: 30 * SECOND_MS },
  { majorTickMs: 5 * MINUTE_MS, minorTickMs: 1 * MINUTE_MS },
  { majorTickMs: 10 * MINUTE_MS, minorTickMs: 2 * MINUTE_MS },
]

const MIN_MAJOR_TICK_COUNT = 6
const MAX_MAJOR_TICK_COUNT = 11
const TARGET_MAJOR_TICK_SPACING_PX = 72
const MAX_MINOR_TICK_SPACING_PX = 26

export const getTimelineUsableWidthPx = (contentWidthPx: number) => {
  return Math.max(contentWidthPx - CONTENT_HORIZONTAL_INSET_PX * 2, 0)
}

export const clampToTimeline = (
  timeMs: number,
  timelineDurationMs: number
) => {
  return Math.max(0, Math.min(timeMs, timelineDurationMs))
}

export const timeToPercent = (
  timeMs: number,
  timelineDurationMs: number
) => {
  if (timelineDurationMs <= 0) {
    return 0
  }

  return (timeMs / timelineDurationMs) * 100
}

export const timeToPx = (
  timeMs: number,
  timelineDurationMs: number,
  contentWidthPx: number
) => {
  if (timelineDurationMs <= 0 || contentWidthPx <= 0) {
    return 0
  }

  const usableWidthPx = getTimelineUsableWidthPx(contentWidthPx)

  return CONTENT_HORIZONTAL_INSET_PX + (timeMs / timelineDurationMs) * usableWidthPx
}

export const durationToPx = (
  durationMs: number,
  timelineDurationMs: number,
  contentWidthPx: number
) => {
  if (timelineDurationMs <= 0 || contentWidthPx <= 0) {
    return 0
  }

  const usableWidthPx = getTimelineUsableWidthPx(contentWidthPx)

  return (durationMs / timelineDurationMs) * usableWidthPx
}

export const pxToTime = (
  xPx: number,
  timelineDurationMs: number,
  contentWidthPx: number
) => {
  if (timelineDurationMs <= 0 || contentWidthPx <= 0) {
    return 0
  }

  const usableWidthPx = getTimelineUsableWidthPx(contentWidthPx)

  if (usableWidthPx <= 0) {
    return 0
  }

  const usableX = Math.max(
    0,
    Math.min(xPx - CONTENT_HORIZONTAL_INSET_PX, usableWidthPx)
  )

  return Math.round((usableX / usableWidthPx) * timelineDurationMs)
}

export const selectRulerScale = (
  visibleDurationMs: number,
  viewportWidthPx: number
) => {
  if (visibleDurationMs <= 0) {
    return RULER_SCALE_PRESETS[0]
  }

  const targetMajorTickCount = getMajorTickCountForWidth(viewportWidthPx)
  const targetMajorTickMs = visibleDurationMs / targetMajorTickCount

  return RULER_SCALE_PRESETS.reduce((bestScale, scale) => {
    if (!bestScale) {
      return scale
    }

    return scoreRulerScale(scale, targetMajorTickMs) <
      scoreRulerScale(bestScale, targetMajorTickMs)
      ? scale
      : bestScale
  })
}

const getMajorTickCountForWidth = (viewportWidthPx: number) => {
  if (viewportWidthPx <= 0) {
    return MAX_MAJOR_TICK_COUNT
  }

  return Math.max(
    MIN_MAJOR_TICK_COUNT,
    Math.min(
      Math.round(viewportWidthPx / TARGET_MAJOR_TICK_SPACING_PX),
      MAX_MAJOR_TICK_COUNT
    )
  )
}

const scoreRulerScale = (
  scale: RulerScale,
  targetMajorTickMs: number
) => {
  if (targetMajorTickMs <= 0) {
    return Infinity
  }

  const scaleRatio = scale.majorTickMs / targetMajorTickMs
  const distanceFromTarget = Math.abs(Math.log2(scaleRatio))
  const gapPenalty = scaleRatio > 1 ? (scaleRatio - 1) * 0.35 : 0

  return distanceFromTarget + gapPenalty
}

export const selectMinorTickMs = (
  timelineDurationMs: number,
  contentWidthPx: number,
  majorTickMs: number,
  baseMinorTickMs: number
) => {
  if (
    timelineDurationMs <= 0 ||
    contentWidthPx <= 0 ||
    majorTickMs <= 0 ||
    baseMinorTickMs <= 0
  ) {
    return baseMinorTickMs
  }

  const candidates = RULER_SCALE_PRESETS
    .map((scale) => scale.minorTickMs)
    .filter(
      (minorTickMs, index, allMinorTickMs) =>
        minorTickMs <= baseMinorTickMs &&
        minorTickMs < majorTickMs &&
        majorTickMs % minorTickMs === 0 &&
        allMinorTickMs.indexOf(minorTickMs) === index
    )
    .sort((leftMinorTickMs, rightMinorTickMs) => rightMinorTickMs - leftMinorTickMs)

  let selectedMinorTickMs = baseMinorTickMs

  for (const minorTickMs of candidates) {
    const minorTickSpacingPx = durationToPx(
      minorTickMs,
      timelineDurationMs,
      contentWidthPx
    )

    selectedMinorTickMs = minorTickMs

    if (minorTickSpacingPx <= MAX_MINOR_TICK_SPACING_PX) {
      break
    }
  }

  return selectedMinorTickMs
}
