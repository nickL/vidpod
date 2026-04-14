import { useMemo } from "react"

import type { Marker } from "../types"

import { MarkerSegment } from "./marker-segment"
import { buildSegments, type Segment } from "./segments"

type TrackProps = {
  markers: Marker[]
  timelineDurationMs: number
  selectedMarkerId?: string
  draggingMarkerId?: string
  onMarkerDragStart?: (
    event: React.PointerEvent<HTMLDivElement>,
    markerId: string
  ) => void
}

type TrackSegmentProps = {
  segment: Segment
  selectedMarkerId?: string
  draggingMarkerId?: string
  onMarkerDragStart?: (
    event: React.PointerEvent<HTMLDivElement>,
    markerId: string
  ) => void
}

export const Track = ({
  markers,
  timelineDurationMs,
  selectedMarkerId,
  draggingMarkerId,
  onMarkerDragStart,
}: TrackProps) => {
  const segments = useMemo(
    () => buildSegments(markers, timelineDurationMs),
    [markers, timelineDurationMs]
  )

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
            segment={segment}
            selectedMarkerId={selectedMarkerId}
            draggingMarkerId={draggingMarkerId}
            onMarkerDragStart={onMarkerDragStart}
          />
        ))}
      </div>
    </div>
  )
}

const TrackSegment = ({
  segment,
  selectedMarkerId,
  draggingMarkerId,
  onMarkerDragStart,
}: TrackSegmentProps) => {
  const durationMs = segment.endMs - segment.startMs

  if (segment.type === "content") {
    return <ContentSegment durationMs={durationMs} />
  }

  return (
    <MarkerSegment
      marker={segment.marker}
      flexGrow={durationMs}
      isDragging={segment.marker.id === draggingMarkerId}
      isSelected={segment.marker.id === selectedMarkerId}
      onDragStart={onMarkerDragStart}
    />
  )
}

const ContentSegment = ({ durationMs }: { durationMs: number }) => (
  <div
    className="min-w-0 rounded-md"
    style={{
      flexGrow: durationMs,
      flexBasis: 0,
      background: "linear-gradient(to bottom, #F0ABFC, #F3BCFD)",
    }}
  />
)
