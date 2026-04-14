"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { updateMarkerAction } from "../actions"
import { episodeEditorQueryKey } from "../queries"
import { useEditorCache } from "../use-editor-cache"
import { matchesMarkerState, sortMarkers } from "./helpers"

import type { Marker } from "../types"
import type { MarkerHistoryEntry } from "./history"

type QueuedMarkerSave = {
  requestedTimeMs: number
  saveId: number
  beforeMarker: Marker
}

// Note: On drag, it kicks off an in-flight save per marker. Any new drags replace the queued save. When the in-flight one finishes, then flush whatever is queued.
export const useMarkerDragSaves = ({
  episodeId,
  markers,
  pushHistory,
}: {
  episodeId: string
  markers?: Marker[]
  pushHistory: (change: MarkerHistoryEntry) => void
}) => {
  const queryClient = useQueryClient()
  const queryKey = episodeEditorQueryKey(episodeId)
  const cache = useEditorCache(episodeId)
  const activeSaveIdsRef = useRef<Record<string, number>>({})
  const queuedSavesRef = useRef<Record<string, QueuedMarkerSave | undefined>>(
    {}
  )
  const nextSaveIdRef = useRef(0)
  const [pendingMarkerTimes, setPendingMarkerTimes] = useState<Record<string, number>>(
    {}
  )
  const [pendingDragSaveCount, setPendingDragSaveCount] = useState(0)

  const updatePendingTime = useCallback(
    (markerId: string, requestedTimeMs: number | undefined) => {
      setPendingMarkerTimes((currentTimes) => {
        if (requestedTimeMs === undefined) {
          if (currentTimes[markerId] === undefined) {
            return currentTimes
          }

          const nextTimes = { ...currentTimes }

          delete nextTimes[markerId]
          return nextTimes
        }

        return {
          ...currentTimes,
          [markerId]: requestedTimeMs,
        }
      })
    },
    []
  )

  const displayedMarkers = useMemo(() => {
    const currentMarkers = markers ?? []

    return sortMarkers(
      currentMarkers.map((marker) => {
        const pendingRequestedTimeMs = pendingMarkerTimes[marker.id]

        return pendingRequestedTimeMs === undefined
          ? marker
          : { ...marker, requestedTimeMs: pendingRequestedTimeMs }
      })
    )
  }, [markers, pendingMarkerTimes])

  const startDragSave = useCallback(() => {
    setPendingDragSaveCount((count) => count + 1)
  }, [])

  const finishDragSave = useCallback(() => {
    setPendingDragSaveCount((count) => Math.max(count - 1, 0))
  }, [])

  const flushQueuedSave = useCallback(
    // Note: named so the recursive call stays within this fn even if useCallback swaps the outer const.
    async function flushQueuedSave(markerId: string) {
      const queuedSave = queuedSavesRef.current[markerId]

      if (!queuedSave) {
        return
      }

      delete queuedSavesRef.current[markerId]
      activeSaveIdsRef.current[markerId] = queuedSave.saveId
      startDragSave()

      try {
        const updatedMarker = await updateMarkerAction({
          markerId,
          requestedTimeMs: queuedSave.requestedTimeMs,
        })
        const hasNewerQueuedSave = queuedSavesRef.current[markerId] !== undefined

        if (!hasNewerQueuedSave) {
          cache.markers.save(updatedMarker)
          updatePendingTime(markerId, undefined)

          if (!matchesMarkerState(queuedSave.beforeMarker, updatedMarker)) {
            pushHistory({
              kind: "update",
              before: queuedSave.beforeMarker,
              after: updatedMarker,
            })
          }
        }
      } catch {
        const hasNewerQueuedSave = queuedSavesRef.current[markerId] !== undefined

        if (!hasNewerQueuedSave) {
          updatePendingTime(markerId, undefined)
        }
      } finally {
        if (activeSaveIdsRef.current[markerId] === queuedSave.saveId) {
          delete activeSaveIdsRef.current[markerId]
        }

        if (queuedSavesRef.current[markerId]) {
          flushQueuedSave(markerId)
        }

        queryClient.invalidateQueries({ queryKey })
        finishDragSave()
      }
    },
    [
      cache.markers,
      finishDragSave,
      pushHistory,
      queryClient,
      queryKey,
      startDragSave,
      updatePendingTime,
    ]
  )

  const queueMarkerSave = useCallback(
    (markerId: string, requestedTimeMs: number) => {
      const currentMarker = markers?.find((marker) => marker.id === markerId)
      const existingQueuedSave = queuedSavesRef.current[markerId]

      if (!currentMarker && !existingQueuedSave) {
        return
      }

      const beforeMarker = existingQueuedSave?.beforeMarker ?? currentMarker

      if (!beforeMarker || beforeMarker.requestedTimeMs === requestedTimeMs) {
        return
      }

      updatePendingTime(markerId, requestedTimeMs)

      const saveId = nextSaveIdRef.current + 1

      nextSaveIdRef.current = saveId
      queuedSavesRef.current[markerId] = {
        requestedTimeMs,
        saveId,
        beforeMarker,
      }

      if (activeSaveIdsRef.current[markerId] !== undefined) {
        return
      }

      flushQueuedSave(markerId)
    },
    [flushQueuedSave, markers, updatePendingTime]
  )

  const clearPendingMarkerTime = useCallback(
    (markerId: string) => {
      updatePendingTime(markerId, undefined)
    },
    [updatePendingTime]
  )

  const savingMarkerIds = useMemo(
    () => Object.keys(pendingMarkerTimes),
    [pendingMarkerTimes]
  )

  return {
    clearPendingMarkerTime,
    displayedMarkers,
    hasPendingMarkerDragSaves: pendingDragSaveCount > 0,
    pendingMarkerTimes,
    queueMarkerSave,
    savingMarkerIds,
  }
}
