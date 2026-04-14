import type { Marker } from "../types"

export type MarkerDialogDraft = {
  requestedTimeMs: number
  selectionMode: Marker["selectionMode"]
  selectedAdAssetIds: string[]
}

export type MarkerDialogState = {
  mode: "create" | "edit"
  step: "select-mode" | "select-ads"
  markerId?: string
  draft: MarkerDialogDraft
}
