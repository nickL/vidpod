import { useMemo } from "react"

import type { Marker, MediaWaveform, MediaWaveformStatus } from "../types"

import {
  buildTimelineWaveformBars,
  ContentWaveform,
  type WaveformBar,
} from "./content-waveform"
import { MarkerDragOverlay } from "./marker-drag-overlay"
import { MarkerSegment } from "./marker-segment"
import { buildSegments, type Segment } from "./segments"

type TrackProps = {
  contentWidthPx: number
  markers: Marker[]
  timelineDurationMs: number
  waveform?: MediaWaveform
  selectedMarkerId?: string
  draggingMarkerId?: string
  draftRequestedTimeMs?: number
  isDraftTimeOpen?: boolean
  onMarkerDragStart?: (
    event: React.PointerEvent<HTMLDivElement>,
    markerId: string
  ) => void
}

type TrackSegmentProps = {
  contentWidthPx: number
  segment: Segment
  timelineDurationMs: number
  waveformBars?: WaveformBar[]
  waveformStatus: MediaWaveformStatus
  selectedMarkerId?: string
  onMarkerDragStart?: (
    event: React.PointerEvent<HTMLDivElement>,
    markerId: string
  ) => void
}

export const Track = ({
  contentWidthPx,
  markers,
  timelineDurationMs,
  waveform,
  selectedMarkerId,
  draggingMarkerId,
  draftRequestedTimeMs,
  isDraftTimeOpen,
  onMarkerDragStart,
}: TrackProps) => {
  const stationaryMarkers = useMemo(
    () => draggingMarkerId
      ? markers.filter((m) => m.id !== draggingMarkerId)
      : markers,
    [draggingMarkerId, markers]
  )
  const segments = useMemo(
    () => buildSegments(stationaryMarkers, timelineDurationMs),
    [stationaryMarkers, timelineDurationMs]
  )
  const waveformBars = useMemo(
    () =>
      buildTimelineWaveformBars({
        contentWidthPx,
        timelineDurationMs,
        waveform,
      }),
    [contentWidthPx, timelineDurationMs, waveform]
  )
  const waveformStatus: MediaWaveformStatus = waveform?.status ?? "pending"
  const draggingMarker = draggingMarkerId
    ? markers.find((m) => m.id === draggingMarkerId)
    : undefined

  return (
    <div className="relative h-32 rounded-l-lg bg-zinc-950 py-2">
      <div className="flex h-full gap-0.5 px-2">
        {segments.map((segment) => (
          <TrackSegment
            key={
              segment.type === "marker"
                ? `marker-${segment.marker.id}`
                : `content-${segment.startMs}-${segment.endMs}`
            }
            contentWidthPx={contentWidthPx}
            segment={segment}
            timelineDurationMs={timelineDurationMs}
            waveformBars={waveformBars}
            waveformStatus={waveformStatus}
            selectedMarkerId={selectedMarkerId}
            onMarkerDragStart={onMarkerDragStart}
          />
        ))}
      </div>

      {draggingMarker && draftRequestedTimeMs !== undefined && (
        <MarkerDragOverlay
          marker={draggingMarker}
          draftRequestedTimeMs={draftRequestedTimeMs}
          timelineDurationMs={timelineDurationMs}
          contentWidthPx={contentWidthPx}
          isDraftTimeOpen={isDraftTimeOpen ?? true}
        />
      )}
    </div>
  )
}

const TrackSegment = ({
  contentWidthPx,
  segment,
  timelineDurationMs,
  waveformBars,
  waveformStatus,
  selectedMarkerId,
  onMarkerDragStart,
}: TrackSegmentProps) => {
  const durationMs = segment.endMs - segment.startMs

  if (segment.type === "content") {
    return (
      <ContentSegment
        contentWidthPx={contentWidthPx}
        durationMs={durationMs}
        segmentEndMs={segment.endMs}
        segmentStartMs={segment.startMs}
        timelineDurationMs={timelineDurationMs}
        waveformBars={waveformBars}
        waveformStatus={waveformStatus}
      />
    )
  }

  return (
    <MarkerSegment
      marker={segment.marker}
      flexGrow={durationMs}
      isSelected={segment.marker.id === selectedMarkerId}
      onDragStart={onMarkerDragStart}
    />
  )
}

const ContentSegment = ({
  contentWidthPx,
  durationMs,
  segmentEndMs,
  segmentStartMs,
  timelineDurationMs,
  waveformBars,
  waveformStatus,
}: {
  contentWidthPx: number
  durationMs: number
  segmentEndMs: number
  segmentStartMs: number
  timelineDurationMs: number
  waveformBars?: WaveformBar[]
  waveformStatus: MediaWaveformStatus
}) => (
  <div
    className="relative min-w-0 overflow-hidden rounded-md"
    style={{
      flexGrow: durationMs,
      flexBasis: 0,
      background: "linear-gradient(to bottom, #F0ABFC, #F3BCFD)",
    }}
  >
    <ContentWaveform
      contentWidthPx={contentWidthPx}
      segmentEndMs={segmentEndMs}
      segmentStartMs={segmentStartMs}
      timelineDurationMs={timelineDurationMs}
      waveformBars={waveformBars}
      waveformStatus={waveformStatus}
    />
  </div>
)
