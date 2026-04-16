import { cn } from "@/lib/utils"

import type { Marker } from "../types"

import { MarkerCard } from "./marker-card"

type MarkerSegmentProps = {
  marker: Marker
  flexGrow: number
  isInteractive?: boolean
  isSelected?: boolean
  onDragStart?: (
    event: React.PointerEvent<HTMLDivElement>,
    markerId: string
  ) => void
}

export const MarkerSegment = ({
  marker,
  flexGrow,
  isInteractive = true,
  isSelected,
  onDragStart,
}: MarkerSegmentProps) => {
  return (
    <div
      draggable={false}
      data-selected={isSelected ? "true" : "false"}
      className={cn(
        "touch-none select-none",
        isInteractive ? "cursor-grab" : "cursor-default"
      )}
      style={{
        flexGrow,
        flexBasis: 0,
      }}
      onDragStart={(event) => {
        event.preventDefault()
      }}
      onPointerDown={(event) => onDragStart?.(event, marker.id)}
    >
      <MarkerCard marker={marker} />
    </div>
  )
}
