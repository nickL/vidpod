"use client"

import { AnimatePresence, motion } from "motion/react"
import { Plus, Trash2, WandSparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn, formatTimecode } from "@/lib/utils"

import type { Marker } from "../types"

const MODE_BADGE = {
  auto:   { label: "Auto",   className: "bg-green-200 text-green-800 border-transparent" },
  static: { label: "Static", className: "bg-blue-200 text-blue-800 border-transparent" },
  ab:     { label: "A/B",    className: "bg-orange-200 text-orange-800 border-transparent" },
} as const

const ROW_ANIMATION = {
  hidden:  { opacity: 0, x: -8, scale: 0.97 },
  visible: { opacity: 1, x: 0,  scale: 1    },
  transition: {
    layout: { type: "spring", stiffness: 380, damping: 32 },
    opacity: { duration: 0.18, ease: "easeOut" },
    x: { duration: 0.22, ease: "easeOut" },
    scale: { duration: 0.22, ease: "easeOut" },
  },
} as const

type MarkerPanelProps = {
  markers: Marker[]
  selectedMarkerId?: string
  savingMarkerIds?: string[]
  deletingMarkerId?: string
  isAutoPlacing?: boolean
  isApplyingHistory?: boolean
  createMarkerDisabledReason?: string
  onEdit?: (markerId: string) => void
  onDelete?: (markerId: string) => void
  onCreateMarker?: () => void
  onAutomaticallyPlace?: () => void
  onActivateMarker?: (markerId: string, requestedTimeMs: number) => void
}

const manropeStyle = { fontFamily: "var(--font-manrope)" }

export const MarkerPanel = ({
  markers,
  selectedMarkerId,
  savingMarkerIds = [],
  deletingMarkerId,
  isAutoPlacing = false,
  isApplyingHistory = false,
  createMarkerDisabledReason,
  onEdit,
  onDelete,
  onCreateMarker,
  onAutomaticallyPlace,
  onActivateMarker,
}: MarkerPanelProps) => {
  return (
    <div className="flex flex-col gap-3" style={manropeStyle}>
      <div className="@container flex min-h-136 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="truncate text-base font-bold text-zinc-800">Ad markers</h2>
          <span className="shrink-0 whitespace-nowrap text-base font-semibold text-zinc-500">
            {markers.length} {markers.length === 1 ? "marker" : "markers"}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <AnimatePresence initial={false} mode="popLayout">
            {markers.map((marker, index) => (
              <MarkerRow
                key={marker.id}
                index={index}
                marker={marker}
                selected={marker.id === selectedMarkerId}
                isSaving={savingMarkerIds.includes(marker.id)}
                isDeleting={deletingMarkerId === marker.id}
                isAutoPlacing={isAutoPlacing}
                isApplyingHistory={isApplyingHistory}
                onEdit={onEdit}
                onDelete={onDelete}
                onActivate={onActivateMarker}
              />
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-auto flex flex-col gap-4 pt-8">
          <Button
            className="w-full rounded-md"
            onClick={onCreateMarker}
            disabled={
              isAutoPlacing ||
              isApplyingHistory ||
              Boolean(createMarkerDisabledReason)
            }
          >
            Create ad marker
            <Plus />
          </Button>
          {createMarkerDisabledReason ? (
            <p className="text-center text-xs text-zinc-500">
              {createMarkerDisabledReason}
            </p>
          ) : null}

          <Button
            variant="outline"
            className="w-full rounded-md border-zinc-200 text-zinc-950"
            onClick={onAutomaticallyPlace}
            disabled={
              isAutoPlacing ||
              isApplyingHistory ||
              deletingMarkerId !== undefined ||
              savingMarkerIds.length > 0
            }
          >
            Automatically place
            <WandSparkles />
          </Button>
        </div>
      </div>
    </div>
  )
}

const MarkerRow = ({
  index,
  marker,
  selected,
  isSaving,
  isDeleting,
  isAutoPlacing,
  isApplyingHistory,
  onEdit,
  onDelete,
  onActivate,
}: {
  index: number
  marker: Marker
  selected: boolean
  isSaving: boolean
  isDeleting: boolean
  isAutoPlacing: boolean
  isApplyingHistory: boolean
  onEdit?: (markerId: string) => void
  onDelete?: (markerId: string) => void
  onActivate?: (markerId: string, requestedTimeMs: number) => void
}) => {
  const actionsDisabled = isAutoPlacing || isApplyingHistory || isSaving || isDeleting
  const badge = MODE_BADGE[marker.selectionMode]

  return (
    <motion.div
      layout
      initial={ROW_ANIMATION.hidden}
      animate={ROW_ANIMATION.visible}
      exit={ROW_ANIMATION.hidden}
      transition={ROW_ANIMATION.transition}
      className="flex items-center gap-4"
    >
      <span className="w-4 shrink-0 text-center text-base font-semibold text-zinc-500">
        {index + 1}
      </span>
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-4 rounded-lg border px-4 py-3",
          selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200",
        )}
        onClick={() => onActivate?.(marker.id, marker.requestedTimeMs)}
      >
        <span className="shrink-0 text-base font-semibold tabular-nums text-zinc-800">
          {formatTimecode(marker.requestedTimeMs)}
        </span>
        <Badge className={cn("rounded-lg px-2.5 text-xs font-semibold", badge.className)}>
          {badge.label}
        </Badge>
        <div className="flex-1" />
        <Button
          variant="outline"
          disabled={actionsDisabled}
          className="h-9 shrink-0 rounded-md border-zinc-200 px-3 text-sm font-semibold text-zinc-950"
          style={manropeStyle}
          onClick={(event) => {
            event.stopPropagation()
            onEdit?.(marker.id)
          }}
        >
          Edit
        </Button>
        <Button
          disabled={actionsDisabled}
          size="icon"
          aria-label="Delete marker"
          className="hidden size-9 shrink-0 rounded-md bg-red-300 p-2 text-red-900 hover:bg-red-400 @[20rem]:inline-flex"
          onClick={(event) => {
            event.stopPropagation()
            onDelete?.(marker.id)
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </motion.div>
  )
}
