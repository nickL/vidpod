"use client"

import { useCallback, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import {
  createMarkerAction,
  deleteMarkerAction,
  updateMarkerAction,
} from "../actions"
import { episodeEditorQueryKey } from "../queries"
import { useEditorCache } from "../use-editor-cache"
import {
  buildAutoPlaceDrafts,
  buildVariantInputs,
  findOpenMarkerTimeMs,
  matchesMarkerDraft,
  toCreateMarkerInput,
  toUpdateMarkerInput,
} from "./helpers"
import type { MarkerDialogDraft } from "./dialog-state"
import type { MarkerHistoryEntry } from "./history"
import { useMarkerDialog } from "./use-marker-dialog"
import { useMarkerDragSaves } from "./use-marker-drag-saves"

import type { Marker, MarkerActivation } from "../types"

export const useMarkerWorkflow = ({
  episodeId,
  markers,
  adLibraryIds,
  durationMs,
  timelineTimeMs,
  isApplyingHistory,
  pushHistory,
}: {
  episodeId: string
  markers?: Marker[]
  adLibraryIds: string[]
  durationMs?: number
  timelineTimeMs: number
  isApplyingHistory: boolean
  pushHistory: (change: MarkerHistoryEntry) => void
}) => {
  const queryClient = useQueryClient()
  const queryKey = episodeEditorQueryKey(episodeId)
  const cache = useEditorCache(episodeId)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string>()
  const [markerActivation, setMarkerActivation] = useState<MarkerActivation>()
  const [isSavingDialog, setIsSavingDialog] = useState(false)
  const [deletingMarkerId, setDeletingMarkerId] = useState<string>()
  const [isAutoPlacing, setIsAutoPlacing] = useState(false)
  const {
    clearPendingMarkerTime,
    displayedMarkers,
    hasPendingMarkerDragSaves,
    pendingMarkerTimes,
    queueMarkerSave,
    savingMarkerIds,
  } = useMarkerDragSaves({
    episodeId,
    markers,
    pushHistory,
  })

  const nextMarkerTimeMs = useMemo(() => {
    return findOpenMarkerTimeMs({
      idealTimeMs: timelineTimeMs,
      markers: displayedMarkers,
      durationMs,
    })
  }, [displayedMarkers, durationMs, timelineTimeMs])

  const createMarkerDisabledReason =
    nextMarkerTimeMs === undefined
      ? "Current video does not have room for another marker."
      : undefined
  const {
    setDialogDraft,
    clearDialog,
    continueDialog,
    markerDialogState,
    openCreateDialog,
    openEditDialog,
    setDialogSelectionMode,
  } = useMarkerDialog({
    displayedMarkers,
    nextMarkerTimeMs,
  })

  const activateMarker = useCallback((markerId: string, requestedTimeMs: number) => {
    setSelectedMarkerId(markerId)
    setMarkerActivation({
      markerId,
      requestedTimeMs,
    })
  }, [])

  const buildCreateInput = useCallback(
    (draft: MarkerDialogDraft) => ({
      markerId: crypto.randomUUID(),
      episodeId,
      requestedTimeMs: draft.requestedTimeMs,
      selectionMode: draft.selectionMode,
      status: "active" as const,
      variants: buildVariantInputs({
        selectionMode: draft.selectionMode,
        selectedAdAssetIds: draft.selectedAdAssetIds,
      }),
    }),
    [episodeId]
  )

  const applyDeletion = useCallback(
    async (markerId: string) => {
      await deleteMarkerAction(markerId)
      cache.markers.remove(markerId)
      clearPendingMarkerTime(markerId)

      if (selectedMarkerId === markerId) {
        setSelectedMarkerId(undefined)
      }
    },
    [cache.markers, clearPendingMarkerTime, selectedMarkerId]
  )

  const applyRestoration = useCallback(
    async (marker: Marker) => {
      const restored = await createMarkerAction(
        toCreateMarkerInput(episodeId, marker)
      )

      cache.markers.save(restored)
      activateMarker(restored.id, restored.requestedTimeMs)
    },
    [activateMarker, cache.markers, episodeId]
  )

  const closeDialog = useCallback(() => {
    if (isSavingDialog) {
      return
    }

    clearDialog()
  }, [clearDialog, isSavingDialog])

  const createFromDraft = useCallback(
    async (draft: MarkerDialogDraft) => {
      const createdMarker = await createMarkerAction(buildCreateInput(draft))

      cache.markers.save(createdMarker)
      activateMarker(createdMarker.id, createdMarker.requestedTimeMs)
      pushHistory({
        kind: "create",
        marker: createdMarker,
      })
    },
    [activateMarker, buildCreateInput, cache.markers, pushHistory]
  )

  const updateFromDraft = useCallback(
    async (markerId: string, draft: MarkerDialogDraft) => {
      const currentMarker = markers?.find((marker) => marker.id === markerId)

      if (!currentMarker) {
        return
      }

      if (matchesMarkerDraft(currentMarker, draft)) {
        return
      }

      const updatedMarker = await updateMarkerAction({
        markerId,
        selectionMode: draft.selectionMode,
        status: "active",
        variants: buildVariantInputs({
          selectionMode: draft.selectionMode,
          selectedAdAssetIds: draft.selectedAdAssetIds,
          currentMarker,
        }),
      })

      cache.markers.save(updatedMarker)
      activateMarker(updatedMarker.id, updatedMarker.requestedTimeMs)
      pushHistory({
        kind: "update",
        before: currentMarker,
        after: updatedMarker,
      })
    },
    [activateMarker, cache.markers, markers, pushHistory]
  )

  const confirmDialog = useCallback(async () => {
    if (
      !markerDialogState ||
      isSavingDialog ||
      isAutoPlacing ||
      isApplyingHistory
    ) {
      return
    }

    setIsSavingDialog(true)

    try {
      if (markerDialogState.mode === "create") {
        await createFromDraft(markerDialogState.draft)
      } else if (markerDialogState.markerId) {
        await updateFromDraft(
          markerDialogState.markerId,
          markerDialogState.draft
        )
      }

      clearDialog()
      queryClient.invalidateQueries({ queryKey })
    } finally {
      setIsSavingDialog(false)
    }
  }, [
    createFromDraft,
    isApplyingHistory,
    isAutoPlacing,
    isSavingDialog,
    markerDialogState,
    clearDialog,
    queryClient,
    queryKey,
    updateFromDraft,
  ])

  const deleteMarker = useCallback(
    async (markerId: string) => {
      if (
        deletingMarkerId ||
        isAutoPlacing ||
        isApplyingHistory ||
        pendingMarkerTimes[markerId] !== undefined
      ) {
        return
      }

      const currentMarker = markers?.find((marker) => marker.id === markerId)

      if (!currentMarker) {
        return
      }

      setDeletingMarkerId(markerId)

      try {
        await applyDeletion(markerId)
        pushHistory({
          kind: "delete",
          marker: currentMarker,
        })

        queryClient.invalidateQueries({ queryKey })
      } finally {
        setDeletingMarkerId(undefined)
      }
    },
    [
      applyDeletion,
      deletingMarkerId,
      isApplyingHistory,
      isAutoPlacing,
      markers,
      pendingMarkerTimes,
      pushHistory,
      queryClient,
      queryKey,
    ]
  )

  const autoPlaceMarkers = useCallback(async () => {
    const markerDrafts = buildAutoPlaceDrafts({
      adLibraryIds,
      durationMs,
      markers: displayedMarkers,
    })

    if (markerDrafts.length === 0) {
      return
    }

    if (isAutoPlacing || isApplyingHistory || deletingMarkerId) {
      return
    }

    setIsAutoPlacing(true)

    try {
      const createdMarkers: Marker[] = []

      for (const draft of markerDrafts) {
        const createdMarker = await createMarkerAction(buildCreateInput(draft))

        createdMarkers.push(createdMarker)
      }

      cache.markers.replace([...displayedMarkers, ...createdMarkers])

      if (createdMarkers[0]) {
        activateMarker(createdMarkers[0].id, createdMarkers[0].requestedTimeMs)
      }

      pushHistory({
        kind: "batch",
        changes: createdMarkers.map((marker) => ({
          kind: "create",
          marker,
        })),
      })

      queryClient.invalidateQueries({ queryKey })
    } finally {
      setIsAutoPlacing(false)
    }
  }, [
    activateMarker,
    adLibraryIds,
    buildCreateInput,
    cache.markers,
    deletingMarkerId,
    displayedMarkers,
    durationMs,
    isApplyingHistory,
    isAutoPlacing,
    pushHistory,
    queryClient,
    queryKey,
  ])

  const applyHistoryEntry = useCallback(
    async (change: MarkerHistoryEntry, direction: "undo" | "redo") => {
      if (change.kind === "batch") {
        const batchChanges =
          direction === "undo" ? [...change.changes].reverse() : change.changes

        for (const batchChange of batchChanges) {
          await applyHistoryEntry(batchChange, direction)
        }

        return
      }

      if (change.kind === "create") {
        if (direction === "undo") {
          await applyDeletion(change.marker.id)
          return
        }

        await applyRestoration(change.marker)
        return
      }

      if (change.kind === "delete") {
        if (direction === "undo") {
          await applyRestoration(change.marker)
          return
        }

        await applyDeletion(change.marker.id)
        return
      }

      const nextMarker = direction === "undo" ? change.before : change.after
      const updatedMarker = await updateMarkerAction(toUpdateMarkerInput(nextMarker))

      cache.markers.save(updatedMarker)
      activateMarker(updatedMarker.id, updatedMarker.requestedTimeMs)
      clearPendingMarkerTime(updatedMarker.id)
    },
    [activateMarker, applyDeletion, applyRestoration, cache.markers, clearPendingMarkerTime]
  )

  return {
    activateMarker,
    applyHistoryEntry,
    autoPlaceMarkers,
    setDialogDraft,
    closeDialog,
    confirmDialog,
    continueDialog,
    createMarkerDisabledReason,
    deleteMarker,
    deletingMarkerId,
    displayedMarkers,
    hasPendingMarkerDragSaves,
    isAutoPlacing,
    isSavingDialog,
    markerActivation,
    markerDialogState,
    openCreateDialog,
    openEditDialog,
    queueMarkerSave,
    savingMarkerIds,
    selectMarker: setSelectedMarkerId,
    selectedMarkerId,
    setDialogSelectionMode,
  }
}
