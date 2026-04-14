import { describe, expect, it } from "vitest"

import {
  CONTENT_HORIZONTAL_INSET_PX,
  durationToPx,
  pxToTime,
  selectMinorTickMs,
  timeToPx,
} from "./shared"

describe("timeline shared math", () => {
  it("converts a time span to width", () => {
    const timelineDurationMs = 100_000
    const contentWidthPx = 236
    const startTimeMs = 20_000
    const durationMs = 30_000

    const absoluteWidthPx =
      timeToPx(startTimeMs + durationMs, timelineDurationMs, contentWidthPx) -
      timeToPx(startTimeMs, timelineDurationMs, contentWidthPx)

    expect(durationToPx(durationMs, timelineDurationMs, contentWidthPx)).toBeCloseTo(
      absoluteWidthPx
    )
    expect(durationToPx(0, timelineDurationMs, contentWidthPx)).toBe(0)
  })

  it("maps the visible timeline bounds to start and end time", () => {
    const timelineDurationMs = 100_000
    const contentWidthPx = 236

    expect(
      pxToTime(CONTENT_HORIZONTAL_INSET_PX, timelineDurationMs, contentWidthPx)
    ).toBe(0)
    expect(
      pxToTime(
        contentWidthPx - CONTENT_HORIZONTAL_INSET_PX,
        timelineDurationMs,
        contentWidthPx
      )
    ).toBe(timelineDurationMs)
  })

  it("keeps ruler tick density consistent", () => {
    expect(selectMinorTickMs(100_000, 236, 60_000, 10_000)).toBe(10_000)
  })
})
