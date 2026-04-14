"use client"

import { Plus, Sparkles, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatTimecode } from "@/lib/utils"

import type { Marker } from "./types"

const modeBadgeStyles = {
  auto: "bg-green-200 text-green-800 border-transparent",
  static: "bg-blue-200 text-blue-800 border-transparent",
  ab: "bg-orange-200 text-orange-800 border-transparent",
} as const

const modeBadgeLabels = {
  auto: "Auto",
  static: "Static",
  ab: "A/B",
} as const

type MarkerPanelProps = {
  markers: Marker[]
  selectedMarkerId?: string
  onEdit?: (markerId: string) => void
  onCreateMarker?: () => void
  onActivateMarker?: (markerId: string, requestedTimeMs: number) => void
}

export const MarkerPanel = ({
  markers,
  selectedMarkerId,
  onEdit,
  onCreateMarker,
  onActivateMarker,
}: MarkerPanelProps) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-136 flex-col rounded-2xl border border-zinc-200 bg-white p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-900">Ad markers</h2>
          <span className="text-xs text-zinc-500">
            {markers.length} {markers.length === 1 ? "marker" : "markers"}
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {markers.map((marker, index) => (
            <div key={marker.id} className="flex items-center gap-2 sm:gap-4">
              <span className="w-5 shrink-0 text-center text-sm text-zinc-400">
                {index + 1}
              </span>
              <div
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-3 sm:gap-3 sm:px-4 sm:py-3.5 ${
                  marker.id === selectedMarkerId
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-zinc-200"
                }`}
                onClick={() => onActivateMarker?.(marker.id, marker.requestedTimeMs)}
              >
                <span className="shrink-0 text-base tabular-nums text-zinc-700">
                  {formatTimecode(marker.requestedTimeMs)}
                </span>
                <Badge className={modeBadgeStyles[marker.selectionMode]}>
                  {modeBadgeLabels[marker.selectionMode]}
                </Badge>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  className="shrink-0"
                  onClick={(event) => {
                    event.stopPropagation()
                    onEdit?.(marker.id)
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="icon-lg"
                  className="hidden shrink-0 bg-red-300 text-red-900 hover:bg-red-400 sm:inline-flex"
                  onClick={(event) => {
                    event.stopPropagation()
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-4 pt-8">
          <Button size="lg" className="w-full" onClick={onCreateMarker}>
            Create ad marker
            <Plus />
          </Button>

          <Button variant="outline" size="lg" className="w-full" onClick={() => {}}>
            Automatically place
            <Sparkles />
          </Button>
        </div>
      </div>
    </div>
  )
}
