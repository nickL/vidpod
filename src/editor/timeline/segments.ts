import type { Marker } from "../types"

import { MARKER_DURATION_MS } from "./shared"

export type ContentSegment = {
  type: "content"
  startMs: number
  endMs: number
}

export type MarkerSegment = {
  type: "marker"
  startMs: number
  endMs: number
  marker: Marker
}

export type Segment = ContentSegment | MarkerSegment

export const buildSegments = (
  markers: Marker[],
  timelineDurationMs: number
): Segment[] => {
  if (timelineDurationMs <= 0) {
    return []
  }

  const sorted = [...markers].sort(
    (a, b) => a.requestedTimeMs - b.requestedTimeMs
  )
  const segments: Segment[] = []
  let cursor = 0

  for (const marker of sorted) {
    const markerStart = Math.max(
      0,
      Math.min(marker.requestedTimeMs, timelineDurationMs)
    )
    const markerEnd = Math.min(
      markerStart + MARKER_DURATION_MS,
      timelineDurationMs
    )

    if (markerEnd <= markerStart || markerStart >= timelineDurationMs) {
      continue
    }

    if (markerStart > cursor) {
      segments.push({
        type: "content",
        startMs: cursor,
        endMs: markerStart,
      })
    }

    segments.push({
      type: "marker",
      startMs: markerStart,
      endMs: markerEnd,
      marker,
    })

    cursor = Math.max(cursor, markerEnd)
  }

  if (cursor < timelineDurationMs) {
    segments.push({
      type: "content",
      startMs: cursor,
      endMs: timelineDurationMs,
    })
  }

  return segments
}
