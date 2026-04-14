"use client"

import { useCallback, useState } from "react"

import type { Marker } from "../types"
import type { MarkerDialogDraft, MarkerDialogState } from "./dialog-state"

export const useMarkerDialog = ({
  displayedMarkers,
  nextMarkerTimeMs,
}: {
  displayedMarkers: Marker[]
  nextMarkerTimeMs?: number
}) => {
  const [markerDialogState, setMarkerDialogState] = useState<MarkerDialogState>()

  const updateState = useCallback(
    (updater: (current: MarkerDialogState) => MarkerDialogState) => {
      setMarkerDialogState((currentState) =>
        currentState ? updater(currentState) : currentState
      )
    },
    []
  )

  const openCreateDialog = useCallback(() => {
    if (nextMarkerTimeMs === undefined) {
      return
    }

    setMarkerDialogState({
      mode: "create",
      step: "select-mode",
      draft: {
        requestedTimeMs: nextMarkerTimeMs,
        selectionMode: "static",
        selectedAdAssetIds: [],
      },
    })
  }, [nextMarkerTimeMs])

  const openEditDialog = useCallback(
    (markerId: string) => {
      const marker = displayedMarkers.find(
        (currentMarker) => currentMarker.id === markerId
      )

      if (!marker) {
        return
      }

      setMarkerDialogState({
        mode: "edit",
        step: "select-ads",
        markerId,
        draft: {
          requestedTimeMs: marker.requestedTimeMs,
          selectionMode: marker.selectionMode,
          selectedAdAssetIds: marker.variants.map((variant) => variant.adAssetId),
        },
      })
    },
    [displayedMarkers]
  )

  const setDialogSelectionMode = useCallback(
    (selectionMode: Marker["selectionMode"]) => {
      updateState((currentState) => ({
        ...currentState,
        draft: {
          ...currentState.draft,
          selectionMode,
          selectedAdAssetIds: [],
        },
      }))
    },
    [updateState]
  )

  const continueDialog = useCallback(() => {
    updateState((currentState) => ({
      ...currentState,
      step: "select-ads",
    }))
  }, [updateState])

  const setDialogDraft = useCallback(
    (draft: MarkerDialogDraft) => {
      updateState((currentState) => ({ ...currentState, draft }))
    },
    [updateState]
  )

  const clearDialog = useCallback(() => {
    setMarkerDialogState(undefined)
  }, [])

  return {
    markerDialogState,
    openCreateDialog,
    openEditDialog,
    setDialogSelectionMode,
    continueDialog,
    setDialogDraft,
    clearDialog,
  }
}
