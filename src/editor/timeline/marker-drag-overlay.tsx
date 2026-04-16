import { motion } from "motion/react"

import type { Marker } from "../types"

import { MarkerCard } from "./marker-card"
import { durationToPx, MARKER_DURATION_MS, timeToPx } from "./shared"

const LIFT_SPRING = { type: "spring", stiffness: 420, damping: 28 } as const
const GHOST_EASE = { duration: 0.25, ease: "easeOut" } as const

type MarkerDragOverlayProps = {
  marker: Marker
  draftRequestedTimeMs: number
  timelineDurationMs: number
  contentWidthPx: number
  isDraftTimeOpen: boolean
}

export const MarkerDragOverlay = ({
  marker,
  draftRequestedTimeMs,
  timelineDurationMs,
  contentWidthPx,
  isDraftTimeOpen,
}: MarkerDragOverlayProps) => {
  const leftPx = timeToPx(draftRequestedTimeMs, timelineDurationMs, contentWidthPx)
  const widthPx = durationToPx(MARKER_DURATION_MS, timelineDurationMs, contentWidthPx)

  return (
    <motion.div
      className="pointer-events-none absolute top-2 bottom-2"
      style={{ left: leftPx, width: widthPx }}
      animate={{
        scale: 1.05,
        y: -2,
        opacity: isDraftTimeOpen ? 1 : 0.65,
        filter: isDraftTimeOpen
          ? "drop-shadow(0 6px 12px rgba(0,0,0,0.28)) grayscale(0) blur(0px)"
          : "drop-shadow(0 6px 12px rgba(0,0,0,0.28)) grayscale(0.6) blur(0.75px)",
      }}
      transition={{
        scale: LIFT_SPRING,
        y: LIFT_SPRING,
        opacity: GHOST_EASE,
        filter: GHOST_EASE,
      }}
    >
      <MarkerCard marker={marker} />
    </motion.div>
  )
}
