"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import * as tus from "tus-js-client"
import { MotionConfig } from "motion/react"

import { formatDate } from "@/lib/utils"

import { AdLibraryDialog } from "./ad-library-dialog"
import { CreateMarkerDialog } from "./create-marker-dialog"
import {
  createMarkerAction,
  deleteMarkerAction,
  failUploadAction,
  resetDemoEpisodeAction,
  removeEpisodeVideoAction,
  refreshUploadedAssetAction,
  setCurrentEpisodeVideoAction,
  startUploadAction,
  updateMarkerAction,
} from "./actions"
import { MarkerPanel } from "./marker-panel"
import { PlaybackSection } from "./playback-section"
import { episodeEditorQueryKey } from "./query-options"
import { useEditorData } from "./use-editor-data"
import { MARKER_DURATION_MS } from "./timeline/shared"

import type {
  AdLibraryItem,
  EditorData,
  EpisodeVideoAsset,
  Marker,
  MarkerActivation,
  MarkerVariant,
  UploadProgressState,
  UploadTarget,
} from "./types"
import type { MarkerDialogDraft } from "./ad-library-dialog"

type EpisodeEditorProps = {
  episodeId: string
  hlsBaseUrl?: string
}

type QueuedMarkerSave = {
  requestedTimeMs: number
  saveId: number
  beforeMarker: Marker
}

type MarkerDialogState = {
  mode: "create" | "edit"
  step: "select-mode" | "select-ads"
  markerId?: string
  draft: MarkerDialogDraft
}

type HistoryEntry =
  | {
      kind: "create"
      marker: Marker
    }
  | {
      kind: "delete"
      marker: Marker
    }
  | {
      kind: "update"
      before: Marker
      after: Marker
    }
  | {
      kind: "batch"
      changes: HistoryEntry[]
    }

const MAX_UPLOAD_POLL_FAILURES = 5

export const EpisodeEditor = ({
  episodeId,
  hlsBaseUrl,
}: EpisodeEditorProps) => {
  const queryClient = useQueryClient()
  const { data } = useEditorData(episodeId)
  const activeMarkerSaveIdsRef = useRef<Record<string, number>>({})
  const queuedMarkerSavesRef = useRef<Record<string, QueuedMarkerSave | undefined>>(
    {}
  )
  const nextSaveIdRef = useRef(0)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string>()
  const [markerActivation, setMarkerActivation] = useState<MarkerActivation>()
  const [markerDialogState, setMarkerDialogState] = useState<MarkerDialogState>()
  const [pendingMarkerTimes, setPendingMarkerTimes] = useState<Record<string, number>>(
    {}
  )
  const [uploadProgressByMediaAssetId, setUploadProgressByMediaAssetId] =
    useState<Record<string, UploadProgressState>>({})
  const [uploadErrorByTarget, setUploadErrorByTarget] = useState<
    Partial<Record<UploadTarget, string>>
  >({})
  const [timelineTimeMs, setTimelineTimeMs] = useState(0)
  const [pendingMarkerDragSaveCount, setPendingMarkerDragSaveCount] = useState(0)
  const [isSavingMarkerDialog, setIsSavingMarkerDialog] = useState(false)
  const [deletingMarkerId, setDeletingMarkerId] = useState<string>()
  const [isAutoPlacing, setIsAutoPlacing] = useState(false)
  const [isApplyingHistory, setIsApplyingHistory] = useState(false)
  const [isResettingDemo, setIsResettingDemo] = useState(false)
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([])
  const uploadPollTimeoutsRef = useRef<Record<string, number | undefined>>({})
  const uploadPollFailureCountsRef = useRef<Record<string, number>>({})

  const queryKey = episodeEditorQueryKey(episodeId)

  useEffect(() => {
    const uploadPollTimeouts = uploadPollTimeoutsRef.current
    const uploadPollFailureCounts = uploadPollFailureCountsRef.current

    return () => {
      for (const timeoutId of Object.values(uploadPollTimeouts)) {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId)
        }
      }

      for (const mediaAssetId of Object.keys(uploadPollFailureCounts)) {
        delete uploadPollFailureCounts[mediaAssetId]
      }
    }
  }, [])

  const setUploadProgress = useCallback(
    (
      mediaAssetId: string,
      uploadProgress: UploadProgressState | undefined
    ) => {
      setUploadProgressByMediaAssetId((currentProgress) => {
        if (!uploadProgress) {
          if (!currentProgress[mediaAssetId]) {
            return currentProgress
          }

          const nextProgress = { ...currentProgress }

          delete nextProgress[mediaAssetId]
          return nextProgress
        }

        return {
          ...currentProgress,
          [mediaAssetId]: uploadProgress,
        }
      })
    },
    []
  )

  const setUploadError = useCallback(
    (target: UploadTarget, message?: string) => {
      setUploadErrorByTarget((currentErrors) => {
        if (!message) {
          if (!currentErrors[target]) {
            return currentErrors
          }

          const nextErrors = { ...currentErrors }
          delete nextErrors[target]
          return nextErrors
        }

        return {
          ...currentErrors,
          [target]: message,
        }
      })
    },
    []
  )

  const updatePendingMarkerTime = (
    markerId: string,
    requestedTimeMs: number | undefined
  ) => {
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
  }

  const startMarkerDragSave = useCallback(() => {
    setPendingMarkerDragSaveCount((count) => count + 1)
  }, [])

  const finishMarkerDragSave = useCallback(() => {
    setPendingMarkerDragSaveCount((count) => Math.max(count - 1, 0))
  }, [])

  const replaceMarkersInCache = useCallback(
    (markers: Marker[]) => {
      queryClient.setQueryData<EditorData>(queryKey, (currentData) => {
        if (!currentData) {
          return currentData
        }

        return {
          ...currentData,
          markers: sortMarkers(markers),
        }
      })
    },
    [queryClient, queryKey]
  )

  const saveMarkerInCache = useCallback(
    (updatedMarker: Marker) => {
      queryClient.setQueryData<EditorData>(queryKey, (currentData) => {
        if (!currentData) {
          return currentData
        }

        const nextMarkers = currentData.markers.some(
          (marker) => marker.id === updatedMarker.id
        )
          ? currentData.markers.map((marker) =>
              marker.id === updatedMarker.id ? updatedMarker : marker
            )
          : [...currentData.markers, updatedMarker]

        return {
          ...currentData,
          markers: sortMarkers(nextMarkers),
        }
      })
    },
    [queryClient, queryKey]
  )

  const removeMarkerFromCache = useCallback(
    (markerId: string) => {
      queryClient.setQueryData<EditorData>(queryKey, (currentData) => {
        if (!currentData) {
          return currentData
        }

        return {
          ...currentData,
          markers: currentData.markers.filter((marker) => marker.id !== markerId),
        }
      })
    },
    [queryClient, queryKey]
  )

  const saveEpisodeVideoAssetInCache = useCallback(
    (episodeVideoAsset: EpisodeVideoAsset) => {
      queryClient.setQueryData<EditorData>(queryKey, (currentData) => {
        if (!currentData) {
          return currentData
        }

        const nextEpisodeVideoAssets = currentData.episodeVideoAssets.some(
          (currentEpisodeVideoAsset) =>
            currentEpisodeVideoAsset.id === episodeVideoAsset.id
        )
          ? currentData.episodeVideoAssets.map((currentEpisodeVideoAsset) =>
              currentEpisodeVideoAsset.id === episodeVideoAsset.id
                ? episodeVideoAsset
                : currentEpisodeVideoAsset
            )
          : [episodeVideoAsset, ...currentData.episodeVideoAssets]

        return {
          ...currentData,
          episodeVideoAssets: sortEpisodeVideoAssets(nextEpisodeVideoAssets),
        }
      })
    },
    [queryClient, queryKey]
  )

  const removeEpisodeVideoFromCache = useCallback(
    (episodeVideoAssetId: string) => {
      queryClient.setQueryData<EditorData>(queryKey, (currentData) => {
        if (!currentData) {
          return currentData
        }

        return {
          ...currentData,
          episodeVideoAssets: currentData.episodeVideoAssets.filter(
            (episodeVideoAsset) => episodeVideoAsset.id !== episodeVideoAssetId
          ),
        }
      })
    },
    [queryClient, queryKey]
  )

  const saveAdLibraryItemInCache = useCallback(
    (adLibraryItem: AdLibraryItem) => {
      queryClient.setQueryData<EditorData>(queryKey, (currentData) => {
        if (!currentData) {
          return currentData
        }

        const nextAdLibrary = currentData.adLibrary.some(
          (currentAdLibraryItem) => currentAdLibraryItem.id === adLibraryItem.id
        )
          ? currentData.adLibrary.map((currentAdLibraryItem) =>
              currentAdLibraryItem.id === adLibraryItem.id
                ? adLibraryItem
                : currentAdLibraryItem
            )
          : [adLibraryItem, ...currentData.adLibrary]

        return {
          ...currentData,
          adLibrary: sortAdLibrary(nextAdLibrary),
        }
      })
    },
    [queryClient, queryKey]
  )

  const saveCurrentVideoInCache = useCallback(
    (mainMediaAsset: EditorData["mainMediaAsset"]) => {
      queryClient.setQueryData<EditorData>(queryKey, (currentData) => {
        if (!currentData) {
          return currentData
        }

        return {
          ...currentData,
          episode: {
            ...currentData.episode,
            durationMs:
              mainMediaAsset?.durationMs ?? currentData.episode.durationMs,
          },
          mainMediaAsset,
        }
      })
    },
    [queryClient, queryKey]
  )

  const updateMediaAssetStatusInCache = useCallback(
    (mediaAssetId: string, status: UploadProgressState["phase"] | "failed") => {
      queryClient.setQueryData<EditorData>(queryKey, (currentData) => {
        if (!currentData) {
          return currentData
        }

        const nextMainMediaAsset =
          currentData.mainMediaAsset?.id === mediaAssetId
            ? {
                ...currentData.mainMediaAsset,
                status,
              }
            : currentData.mainMediaAsset

        return {
          ...currentData,
          mainMediaAsset: nextMainMediaAsset,
          adLibrary: currentData.adLibrary.map((adLibraryItem) =>
            adLibraryItem.mediaAsset.id === mediaAssetId
              ? {
                  ...adLibraryItem,
                  mediaAsset: {
                    ...adLibraryItem.mediaAsset,
                    status,
                  },
                }
              : adLibraryItem
          ),
          episodeVideoAssets: currentData.episodeVideoAssets.map((episodeVideoAsset) =>
            episodeVideoAsset.mediaAsset.id === mediaAssetId
              ? {
                  ...episodeVideoAsset,
                  mediaAsset: {
                    ...episodeVideoAsset.mediaAsset,
                    status,
                  },
                }
              : episodeVideoAsset
          ),
        }
      })
    },
    [queryClient, queryKey]
  )

  const clearUploadPolling = useCallback((mediaAssetId: string) => {
    const timeoutId = uploadPollTimeoutsRef.current[mediaAssetId]

    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
      delete uploadPollTimeoutsRef.current[mediaAssetId]
    }

    delete uploadPollFailureCountsRef.current[mediaAssetId]
  }, [])

  const handleUploadFailure = useCallback(
    async (mediaAssetId: string) => {
      clearUploadPolling(mediaAssetId)

      try {
        await failUploadAction(mediaAssetId)
      } catch {
        // Keep the local UI honest even if the failure write does not land.
      }

      updateMediaAssetStatusInCache(mediaAssetId, "failed")
      setUploadProgress(mediaAssetId, undefined)
      void queryClient.invalidateQueries({ queryKey })
    },
    [
      clearUploadPolling,
      queryClient,
      queryKey,
      setUploadProgress,
      updateMediaAssetStatusInCache,
    ]
  )

  const pushHistory = useCallback((change: HistoryEntry) => {
    setUndoStack((currentStack) => [...currentStack, change])
    setRedoStack([])
  }, [])

  const displayedMarkers = useMemo(() => {
    const markers = data?.markers ?? []

    return sortMarkers(
      markers.map((marker) => {
        const pendingRequestedTimeMs = pendingMarkerTimes[marker.id]

        return pendingRequestedTimeMs === undefined
          ? marker
          : { ...marker, requestedTimeMs: pendingRequestedTimeMs }
      })
      )
  }, [data?.markers, pendingMarkerTimes])

  const nextMarkerTimeMs = useMemo(() => {
    if (!data) {
      return undefined
    }

    return findOpenMarkerTimeMs({
      idealTimeMs: timelineTimeMs,
      markers: displayedMarkers,
      durationMs: data.episode.durationMs,
    })
  }, [data, displayedMarkers, timelineTimeMs])

  const createMarkerDisabledReason =
    nextMarkerTimeMs === undefined
      ? "Current video does not have room for another marker."
      : undefined

  const previewConfigKey = useMemo(
    () => getPreviewConfigKey(data?.markers ?? [], data?.mainMediaAsset?.id),
    [data?.mainMediaAsset?.id, data?.markers]
  )

  const hasPendingMarkerDragSaves = pendingMarkerDragSaveCount > 0
  const hasPendingMarkerDelete = deletingMarkerId !== undefined
  const canUndo =
    !isApplyingHistory &&
    !isAutoPlacing &&
    !isSavingMarkerDialog &&
    !hasPendingMarkerDelete &&
    !hasPendingMarkerDragSaves &&
    undoStack.length > 0
  const canRedo =
    !isApplyingHistory &&
    !isAutoPlacing &&
    !isSavingMarkerDialog &&
    !hasPendingMarkerDelete &&
    !hasPendingMarkerDragSaves &&
    redoStack.length > 0

  const activateMarker = useCallback((markerId: string, requestedTimeMs: number) => {
    setSelectedMarkerId(markerId)
    setMarkerActivation({
      markerId,
      requestedTimeMs,
    })
  }, [])

  const flushQueuedMarkerSave = useCallback(
    async function flushQueuedMarkerSave(markerId: string) {
      const queuedSave = queuedMarkerSavesRef.current[markerId]

      if (!queuedSave) {
        return
      }

      delete queuedMarkerSavesRef.current[markerId]
      activeMarkerSaveIdsRef.current[markerId] = queuedSave.saveId
      startMarkerDragSave()

      try {
        const updatedMarker = await updateMarkerAction({
          markerId,
          requestedTimeMs: queuedSave.requestedTimeMs,
        })
        const hasNewerQueuedSave = queuedMarkerSavesRef.current[markerId] !== undefined

        if (!hasNewerQueuedSave) {
          saveMarkerInCache(updatedMarker)
          updatePendingMarkerTime(markerId, undefined)

          if (!matchesMarkerState(queuedSave.beforeMarker, updatedMarker)) {
            pushHistory({
              kind: "update",
              before: queuedSave.beforeMarker,
              after: updatedMarker,
            })
          }
        }
      } catch {
        const hasNewerQueuedSave = queuedMarkerSavesRef.current[markerId] !== undefined

        if (!hasNewerQueuedSave) {
          updatePendingMarkerTime(markerId, undefined)
        }
      } finally {
        if (activeMarkerSaveIdsRef.current[markerId] === queuedSave.saveId) {
          delete activeMarkerSaveIdsRef.current[markerId]
        }

        if (queuedMarkerSavesRef.current[markerId]) {
          void flushQueuedMarkerSave(markerId)
        }

        void queryClient.invalidateQueries({ queryKey })
        finishMarkerDragSave()
      }
    },
    [
      finishMarkerDragSave,
      pushHistory,
      queryClient,
      queryKey,
      saveMarkerInCache,
      startMarkerDragSave,
    ]
  )

  const queueMarkerSave = useCallback(
    (markerId: string, requestedTimeMs: number) => {
      const currentMarker = data?.markers.find((marker) => marker.id === markerId)
      const existingQueuedSave = queuedMarkerSavesRef.current[markerId]

      if (!currentMarker && !existingQueuedSave) {
        return
      }

      const beforeMarker = existingQueuedSave?.beforeMarker ?? currentMarker

      if (!beforeMarker || beforeMarker.requestedTimeMs === requestedTimeMs) {
        return
      }

      updatePendingMarkerTime(markerId, requestedTimeMs)

      const saveId = nextSaveIdRef.current + 1

      nextSaveIdRef.current = saveId
      queuedMarkerSavesRef.current[markerId] = {
        requestedTimeMs,
        saveId,
        beforeMarker,
      }

      if (activeMarkerSaveIdsRef.current[markerId] !== undefined) {
        return
      }

      void flushQueuedMarkerSave(markerId)
    },
    [data?.markers, flushQueuedMarkerSave]
  )

  const handleTimelineTimeChange = useCallback((timeMs: number) => {
    setTimelineTimeMs(timeMs)
  }, [])

  const closeMarkerDialog = useCallback(() => {
    if (isSavingMarkerDialog) {
      return
    }

    setMarkerDialogState(undefined)
  }, [isSavingMarkerDialog])

  const openCreateMarkerDialog = useCallback(() => {
    if (!data || nextMarkerTimeMs === undefined) {
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
  }, [data, nextMarkerTimeMs])

  const openEditMarkerDialog = useCallback(
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

  const createMarkerFromDraft = useCallback(
    async (draft: MarkerDialogDraft) => {
      const createdMarker = await createMarkerAction({
        markerId: crypto.randomUUID(),
        episodeId,
        requestedTimeMs: draft.requestedTimeMs,
        selectionMode: draft.selectionMode,
        status: "active",
        variants: buildVariantInputsFromSelection({
          selectionMode: draft.selectionMode,
          selectedAdAssetIds: draft.selectedAdAssetIds,
        }),
      })

      saveMarkerInCache(createdMarker)
      activateMarker(createdMarker.id, createdMarker.requestedTimeMs)
      pushHistory({
        kind: "create",
        marker: createdMarker,
      })
    },
    [activateMarker, episodeId, pushHistory, saveMarkerInCache]
  )

  const updateMarkerFromDraft = useCallback(
    async (markerId: string, draft: MarkerDialogDraft) => {
      const currentMarker = data?.markers.find((marker) => marker.id === markerId)

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
        variants: buildVariantInputsFromSelection({
          selectionMode: draft.selectionMode,
          selectedAdAssetIds: draft.selectedAdAssetIds,
          currentMarker,
        }),
      })

      saveMarkerInCache(updatedMarker)
      activateMarker(updatedMarker.id, updatedMarker.requestedTimeMs)
      pushHistory({
        kind: "update",
        before: currentMarker,
        after: updatedMarker,
      })
    },
    [activateMarker, data?.markers, pushHistory, saveMarkerInCache]
  )

  const handleMarkerDialogConfirm = useCallback(async () => {
    if (!markerDialogState || isSavingMarkerDialog || isAutoPlacing || isApplyingHistory) {
      return
    }

    setIsSavingMarkerDialog(true)

    try {
      if (markerDialogState.mode === "create") {
        await createMarkerFromDraft(markerDialogState.draft)
      } else if (markerDialogState.markerId) {
        await updateMarkerFromDraft(markerDialogState.markerId, markerDialogState.draft)
      }

      setMarkerDialogState(undefined)
      void queryClient.invalidateQueries({ queryKey })
    } finally {
      setIsSavingMarkerDialog(false)
    }
  }, [
    createMarkerFromDraft,
    isApplyingHistory,
    isAutoPlacing,
    isSavingMarkerDialog,
    markerDialogState,
    queryClient,
    queryKey,
    updateMarkerFromDraft,
  ])

  const handleDeleteMarker = useCallback(
    async (markerId: string) => {
      if (
        deletingMarkerId ||
        isAutoPlacing ||
        isApplyingHistory ||
        pendingMarkerTimes[markerId] !== undefined
      ) {
        return
      }

      const currentMarker = data?.markers.find((marker) => marker.id === markerId)

      if (!currentMarker) {
        return
      }

      setDeletingMarkerId(markerId)

      try {
        await deleteMarkerAction(markerId)
        removeMarkerFromCache(markerId)
        updatePendingMarkerTime(markerId, undefined)

        if (selectedMarkerId === markerId) {
          setSelectedMarkerId(undefined)
        }

        pushHistory({
          kind: "delete",
          marker: currentMarker,
        })

        void queryClient.invalidateQueries({ queryKey })
      } finally {
        setDeletingMarkerId(undefined)
      }
    },
    [
      data?.markers,
      deletingMarkerId,
      isApplyingHistory,
      isAutoPlacing,
      pendingMarkerTimes,
      pushHistory,
      queryClient,
      queryKey,
      removeMarkerFromCache,
      selectedMarkerId,
    ]
  )

  const handleAutoPlaceMarkers = useCallback(async () => {
    if (!data) {
      return
    }

    const markerDrafts = buildAutoPlaceDrafts({
      adLibrary: data.adLibrary,
      durationMs: data.episode.durationMs,
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
        const createdMarker = await createMarkerAction({
          markerId: crypto.randomUUID(),
          episodeId,
          requestedTimeMs: draft.requestedTimeMs,
          selectionMode: draft.selectionMode,
          status: "active",
          variants: buildVariantInputsFromSelection({
            selectionMode: draft.selectionMode,
            selectedAdAssetIds: draft.selectedAdAssetIds,
          }),
        })

        createdMarkers.push(createdMarker)
      }

      replaceMarkersInCache([...displayedMarkers, ...createdMarkers])

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

      void queryClient.invalidateQueries({ queryKey })
    } finally {
      setIsAutoPlacing(false)
    }
  }, [
    activateMarker,
    data,
    deletingMarkerId,
    displayedMarkers,
    episodeId,
    isApplyingHistory,
    isAutoPlacing,
    pushHistory,
    queryClient,
    queryKey,
    replaceMarkersInCache,
  ])

  const applyHistoryEntry = useCallback(
    async (change: HistoryEntry, direction: "undo" | "redo") => {
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
          await deleteMarkerAction(change.marker.id)
          removeMarkerFromCache(change.marker.id)
          updatePendingMarkerTime(change.marker.id, undefined)

          if (selectedMarkerId === change.marker.id) {
            setSelectedMarkerId(undefined)
          }

          return
        }

        const createdMarker = await createMarkerAction(
          toCreateMarkerInput(episodeId, change.marker)
        )

        saveMarkerInCache(createdMarker)
        activateMarker(createdMarker.id, createdMarker.requestedTimeMs)
        return
      }

      if (change.kind === "delete") {
        if (direction === "undo") {
          const restoredMarker = await createMarkerAction(
            toCreateMarkerInput(episodeId, change.marker)
          )

          saveMarkerInCache(restoredMarker)
          activateMarker(restoredMarker.id, restoredMarker.requestedTimeMs)
          return
        }

        await deleteMarkerAction(change.marker.id)
        removeMarkerFromCache(change.marker.id)
        updatePendingMarkerTime(change.marker.id, undefined)

        if (selectedMarkerId === change.marker.id) {
          setSelectedMarkerId(undefined)
        }

        return
      }

      const nextMarker = direction === "undo" ? change.before : change.after
      const updatedMarker = await updateMarkerAction(toUpdateMarkerInput(nextMarker))

      saveMarkerInCache(updatedMarker)
      activateMarker(updatedMarker.id, updatedMarker.requestedTimeMs)
      updatePendingMarkerTime(updatedMarker.id, undefined)
    },
    [
      activateMarker,
      episodeId,
      removeMarkerFromCache,
      saveMarkerInCache,
      selectedMarkerId,
    ]
  )

  const handleUndo = useCallback(async () => {
    const change = undoStack[undoStack.length - 1]

    if (!change || isApplyingHistory) {
      return
    }

    setIsApplyingHistory(true)

    try {
      setUndoStack((currentStack) => currentStack.slice(0, -1))
      await applyHistoryEntry(change, "undo")
      setRedoStack((currentStack) => [...currentStack, change])
      void queryClient.invalidateQueries({ queryKey })
    } catch {
      setUndoStack((currentStack) => [...currentStack, change])
    } finally {
      setIsApplyingHistory(false)
    }
  }, [applyHistoryEntry, isApplyingHistory, queryClient, queryKey, undoStack])

  const handleRedo = useCallback(async () => {
    const change = redoStack[redoStack.length - 1]

    if (!change || isApplyingHistory) {
      return
    }

    setIsApplyingHistory(true)

    try {
      setRedoStack((currentStack) => currentStack.slice(0, -1))
      await applyHistoryEntry(change, "redo")
      setUndoStack((currentStack) => [...currentStack, change])
      void queryClient.invalidateQueries({ queryKey })
    } catch {
      setRedoStack((currentStack) => [...currentStack, change])
    } finally {
      setIsApplyingHistory(false)
    }
  }, [applyHistoryEntry, isApplyingHistory, queryClient, queryKey, redoStack])

  const pollUploadStatus = useCallback(
    async ({
      target,
      assetId,
      mediaAssetId,
    }: {
      target: UploadTarget
      assetId: string
      mediaAssetId: string
    }) => {
      try {
        let mediaStatus: UploadProgressState["phase"] | "ready" | "failed"

        if (target === "episode") {
          const result = (await refreshUploadedAssetAction({
            target: "episode",
            assetId,
          })) as {
            target: "episode"
            episodeVideoAsset?: EpisodeVideoAsset
          }

          if (!result.episodeVideoAsset) {
            throw new Error("Episode upload did not return refreshed media")
          }

          saveEpisodeVideoAssetInCache(result.episodeVideoAsset)
          mediaStatus = result.episodeVideoAsset.mediaAsset.status
        } else {
          const result = (await refreshUploadedAssetAction({
            target: "ad",
            assetId,
          })) as {
            target: "ad"
            adLibraryItem?: AdLibraryItem
          }

          if (!result.adLibraryItem) {
            throw new Error("Ad upload did not return refreshed media")
          }

          saveAdLibraryItemInCache(result.adLibraryItem)
          mediaStatus = result.adLibraryItem.mediaAsset.status
        }

        uploadPollFailureCountsRef.current[mediaAssetId] = 0

        if (mediaStatus === "ready" || mediaStatus === "failed") {
          clearUploadPolling(mediaAssetId)
          setUploadProgress(mediaAssetId, undefined)
          void queryClient.invalidateQueries({ queryKey })
          return
        }

        setUploadProgress(mediaAssetId, {
          phase: "processing",
          progressPercent: 100,
        })
      } catch {
        const failureCount =
          (uploadPollFailureCountsRef.current[mediaAssetId] ?? 0) + 1

        uploadPollFailureCountsRef.current[mediaAssetId] = failureCount

        if (failureCount >= MAX_UPLOAD_POLL_FAILURES) {
          await handleUploadFailure(mediaAssetId)
          return
        }
      }

      const nextTimeoutId = window.setTimeout(() => {
        void pollUploadStatus({
          target,
          assetId,
          mediaAssetId,
        })
      }, 1500)

      uploadPollTimeoutsRef.current[mediaAssetId] = nextTimeoutId
    },
    [
      queryClient,
      queryKey,
      clearUploadPolling,
      handleUploadFailure,
      saveAdLibraryItemInCache,
      saveEpisodeVideoAssetInCache,
      setUploadProgress,
    ]
  )

  const uploadFile = useCallback(
    async (target: UploadTarget, file: File) => {
      let mediaAssetId: string | undefined

      try {
        setUploadError(target, undefined)

        const uploadStart = await startUploadAction({
          target,
          episodeId,
          filename: file.name,
          fileSize: file.size,
        })

        mediaAssetId =
          uploadStart.target === "episode"
            ? uploadStart.episodeVideoAsset.mediaAsset.id
            : uploadStart.adLibraryItem.mediaAsset.id
        const assetId =
          uploadStart.target === "episode"
            ? uploadStart.episodeVideoAsset.id
            : uploadStart.adLibraryItem.id
        const uploadMediaAssetId = mediaAssetId

        if (uploadStart.target === "episode") {
          saveEpisodeVideoAssetInCache(uploadStart.episodeVideoAsset)
          void queryClient.invalidateQueries({ queryKey })
        } else {
          saveAdLibraryItemInCache(uploadStart.adLibraryItem)
        }

        setUploadProgress(uploadMediaAssetId, {
          phase: "uploading",
          progressPercent: 0,
        })

        const upload = new tus.Upload(file, {
          uploadUrl: uploadStart.uploadUrl,
          retryDelays: [0, 1000, 3000, 5000],
          removeFingerprintOnSuccess: true,
          storeFingerprintForResuming: false,
          metadata: {
            filename: file.name,
            filetype: file.type,
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            setUploadProgress(uploadMediaAssetId, {
              phase: "uploading",
              progressPercent: Math.round((bytesUploaded / bytesTotal) * 100),
            })
          },
          onSuccess: () => {
            setUploadProgress(uploadMediaAssetId, {
              phase: "processing",
              progressPercent: 100,
            })
            void pollUploadStatus({
              target,
              assetId,
              mediaAssetId: uploadMediaAssetId,
            })
          },
          onError: async () => {
            await handleUploadFailure(uploadMediaAssetId)
            setUploadError(target, "Upload failed. Try again.")
          },
        })

        upload.start()
      } catch (error) {
        if (mediaAssetId) {
          await handleUploadFailure(mediaAssetId)
        }

        setUploadError(
          target,
          error instanceof Error ? error.message : "Unable to start upload."
        )
        console.error(error)
      }
    },
    [
      episodeId,
      handleUploadFailure,
      pollUploadStatus,
      queryClient,
      queryKey,
      saveAdLibraryItemInCache,
      saveEpisodeVideoAssetInCache,
      setUploadError,
      setUploadProgress,
    ]
  )

  const handleAddEpisodeVideo = useCallback(
    async (file: File) => {
      await uploadFile("episode", file)
    },
    [uploadFile]
  )

  const handleUploadAds = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        void uploadFile("ad", file)
      }
    },
    [uploadFile]
  )

  const handleUseEpisodeVideo = useCallback(
    async (episodeVideoAssetId: string) => {
      const episodeVideoAsset = await setCurrentEpisodeVideoAction(
        episodeVideoAssetId
      )

      saveEpisodeVideoAssetInCache(episodeVideoAsset)
      saveCurrentVideoInCache(episodeVideoAsset.mediaAsset)
      await queryClient.invalidateQueries({ queryKey })
    },
    [
      queryClient,
      queryKey,
      saveEpisodeVideoAssetInCache,
      saveCurrentVideoInCache,
    ]
  )

  const handleRemoveEpisodeVideo = useCallback(
    async (episodeVideoAssetId: string) => {
      const result = await removeEpisodeVideoAction(episodeVideoAssetId)

      clearUploadPolling(result.mediaAssetId)
      setUploadProgress(result.mediaAssetId, undefined)
      setUploadError("episode", undefined)
      removeEpisodeVideoFromCache(result.episodeVideoAssetId)
      await queryClient.invalidateQueries({ queryKey })
    },
    [
      clearUploadPolling,
      queryClient,
      queryKey,
      removeEpisodeVideoFromCache,
      setUploadError,
      setUploadProgress,
    ]
  )

  const handleResetDemo = useCallback(async () => {
    setIsResettingDemo(true)

    try {
      const mediaAssetIds =
        data?.episodeVideoAssets.map(
          (episodeVideoAsset) => episodeVideoAsset.mediaAsset.id
        ) ?? []

      await resetDemoEpisodeAction(episodeId)

      for (const mediaAssetId of mediaAssetIds) {
        clearUploadPolling(mediaAssetId)
        setUploadProgress(mediaAssetId, undefined)
      }

      setUploadError("episode", undefined)
      await queryClient.invalidateQueries({ queryKey })
    } finally {
      setIsResettingDemo(false)
    }
  }, [
    clearUploadPolling,
    data?.episodeVideoAssets,
    episodeId,
    queryClient,
    queryKey,
    setUploadError,
    setUploadProgress,
  ])

  if (!data) {
    return null
  }

  const publishedDate = data.episode.publishedAt
    ? formatDate(data.episode.publishedAt)
    : "-"
  const subtitle = [data.episode.displayEpisodeNumber, publishedDate]
    .filter(Boolean)
    .join(" • ")
  const replacementEpisodeVideo = getReplacementEpisodeVideo(
    data.episodeVideoAssets,
    data.mainMediaAsset?.id
  )

  return (
    <MotionConfig reducedMotion="user">
      <section className="mx-auto min-h-full max-w-[1232px]">
        <div
          className="flex max-w-[616px] flex-col gap-4"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-500">
            <ArrowLeft className="size-4" />
            Ads
          </p>
          <h1 className="text-balance text-3xl font-bold text-zinc-800">
            {data.episode.title}
          </h1>
          {subtitle ? (
            <p className="text-base font-semibold text-zinc-500">{subtitle}</p>
          ) : null}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 min-[1400px]:grid-cols-[minmax(22rem,26rem)_minmax(0,1fr)]">
          <MarkerPanel
            markers={displayedMarkers}
            selectedMarkerId={selectedMarkerId}
            savingMarkerIds={Object.keys(pendingMarkerTimes)}
            deletingMarkerId={deletingMarkerId}
            isAutoPlacing={isAutoPlacing}
            isApplyingHistory={isApplyingHistory}
            createMarkerDisabledReason={createMarkerDisabledReason}
            onEdit={openEditMarkerDialog}
            onDelete={handleDeleteMarker}
            onCreateMarker={openCreateMarkerDialog}
            onAutomaticallyPlace={handleAutoPlaceMarkers}
            onActivateMarker={activateMarker}
          />
          <PlaybackSection
            key={data.mainMediaAsset?.id ?? "missing-main-media"}
            episodeId={episodeId}
            hlsBaseUrl={hlsBaseUrl}
            episodeDurationMs={data.episode.durationMs}
            mainMediaAsset={data.mainMediaAsset}
            replacementEpisodeVideo={replacementEpisodeVideo}
            uploadError={uploadErrorByTarget.episode}
            videoUploadProgress={
              replacementEpisodeVideo
                ? uploadProgressByMediaAssetId[replacementEpisodeVideo.mediaAsset.id]
                : undefined
            }
            canResetDemo={data.canResetDemo}
            isResettingDemo={isResettingDemo}
            markers={displayedMarkers}
            previewConfigKey={previewConfigKey}
            markerActivation={markerActivation}
            selectedMarkerId={selectedMarkerId}
            canUndo={canUndo}
            canRedo={canRedo}
            onMarkerTimeCommit={queueMarkerSave}
            onActivateMarker={activateMarker}
            onSelectMarker={setSelectedMarkerId}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onDisplayTimeChange={handleTimelineTimeChange}
            onAddEpisodeVideo={handleAddEpisodeVideo}
            onResetDemo={handleResetDemo}
            onRemoveEpisodeVideo={handleRemoveEpisodeVideo}
            onUseEpisodeVideo={handleUseEpisodeVideo}
          />
        </div>

        {markerDialogState ? (
          markerDialogState.step === "select-mode" ? (
            <CreateMarkerDialog
              open
              selectionMode={markerDialogState.draft.selectionMode}
              onSelectionModeChange={(selectionMode) =>
                setMarkerDialogState((currentState) =>
                  currentState
                    ? {
                        ...currentState,
                        draft: {
                          ...currentState.draft,
                          selectionMode,
                          selectedAdAssetIds: [],
                        },
                      }
                    : currentState
                )
              }
              onContinue={() =>
                setMarkerDialogState((currentState) =>
                  currentState
                    ? {
                        ...currentState,
                        step: "select-ads",
                      }
                    : currentState
                )
              }
              onOpenChange={(open) => {
                if (!open) {
                  closeMarkerDialog()
                }
              }}
            />
          ) : (
            <AdLibraryDialog
              open
              mode={markerDialogState.mode}
              adLibrary={data.adLibrary}
              draft={markerDialogState.draft}
              isSaving={isSavingMarkerDialog}
              uploadError={uploadErrorByTarget.ad}
              uploadProgressByMediaAssetId={uploadProgressByMediaAssetId}
              onDraftChange={(draft) =>
                setMarkerDialogState((currentState) =>
                  currentState ? { ...currentState, draft } : currentState
                )
              }
              onConfirm={handleMarkerDialogConfirm}
              onUploadAds={handleUploadAds}
              onOpenChange={(open) => {
                if (!open) {
                  closeMarkerDialog()
                }
              }}
            />
          )
        ) : null}
      </section>
    </MotionConfig>
  )
}

const sortMarkers = (markers: Marker[]) => {
  return [...markers].sort(
    (leftMarker, rightMarker) =>
      leftMarker.requestedTimeMs - rightMarker.requestedTimeMs
  )
}

const getPreviewConfigKey = (markers: Marker[], mainMediaAssetId?: string) => {
  return [
    mainMediaAssetId ?? "missing-main-media",
    markers
      .map((marker) =>
        [
          marker.id,
          marker.requestedTimeMs,
          marker.selectionMode,
          marker.status,
          marker.variants
            .map((variant) =>
              [
                variant.id,
                variant.adAssetId,
                variant.status,
                variant.weight ?? "",
                variant.isControl ? "control" : "",
              ].join(":")
            )
            .join("|"),
        ].join(":")
      )
      .join("~"),
  ].join("::")
}

const sortAdLibrary = (adLibrary: AdLibraryItem[]) => {
  return [...adLibrary].sort(
    (leftAd, rightAd) =>
      new Date(rightAd.createdAt).getTime() - new Date(leftAd.createdAt).getTime()
  )
}

const sortEpisodeVideoAssets = (episodeVideoAssets: EpisodeVideoAsset[]) => {
  return [...episodeVideoAssets].sort(
    (leftVideoAsset, rightVideoAsset) =>
      new Date(rightVideoAsset.createdAt).getTime() -
      new Date(leftVideoAsset.createdAt).getTime()
  )
}

const getReplacementEpisodeVideo = (
  episodeVideoAssets: EpisodeVideoAsset[],
  mainMediaAssetId?: string
) => {
  return episodeVideoAssets.find(
    (episodeVideoAsset) => episodeVideoAsset.mediaAsset.id !== mainMediaAssetId
  )
}

const buildVariantInputsFromSelection = ({
  selectionMode,
  selectedAdAssetIds,
  currentMarker,
}: {
  selectionMode: Marker["selectionMode"]
  selectedAdAssetIds: string[]
  currentMarker?: Marker
}) => {
  return selectedAdAssetIds.map((adAssetId, index) => {
    const currentVariant = currentMarker?.variants.find(
      (variant) => variant.adAssetId === adAssetId
    )

    return {
      adAssetId,
      status: currentVariant?.status ?? "active",
      weight:
        selectionMode === "auto" ? currentVariant?.weight : undefined,
      isControl:
        selectionMode === "ab"
          ? currentVariant?.isControl ?? (index === 0 ? true : undefined)
          : undefined,
    }
  })
}

const toCreateMarkerInput = (episodeId: string, marker: Marker) => {
  return {
    markerId: marker.id,
    episodeId,
    requestedTimeMs: marker.requestedTimeMs,
    selectionMode: marker.selectionMode,
    status: marker.status,
    label: marker.label,
    variants: marker.variants.map((variant) => toVariantInput(variant)),
  }
}

const toUpdateMarkerInput = (marker: Marker) => {
  return {
    markerId: marker.id,
    requestedTimeMs: marker.requestedTimeMs,
    selectionMode: marker.selectionMode,
    status: marker.status,
    label: marker.label,
    variants: marker.variants.map((variant) => toVariantInput(variant)),
  }
}

const toVariantInput = (variant: MarkerVariant) => {
  return {
    adAssetId: variant.adAssetId,
    weight: variant.weight,
    isControl: variant.isControl,
    status: variant.status,
  }
}

const matchesMarkerDraft = (
  marker: Marker,
  draft: MarkerDialogDraft
) => {
  if (marker.selectionMode !== draft.selectionMode) {
    return false
  }

  if (marker.variants.length !== draft.selectedAdAssetIds.length) {
    return false
  }

  return marker.variants.every(
    (variant, index) => variant.adAssetId === draft.selectedAdAssetIds[index]
  )
}

const matchesMarkerState = (leftMarker: Marker, rightMarker: Marker) => {
  if (
    leftMarker.requestedTimeMs !== rightMarker.requestedTimeMs ||
    leftMarker.selectionMode !== rightMarker.selectionMode ||
    leftMarker.status !== rightMarker.status ||
    leftMarker.label !== rightMarker.label ||
    leftMarker.variants.length !== rightMarker.variants.length
  ) {
    return false
  }

  return leftMarker.variants.every((leftVariant, index) => {
    const rightVariant = rightMarker.variants[index]

    return (
      leftVariant.adAssetId === rightVariant?.adAssetId &&
      leftVariant.status === rightVariant.status &&
      leftVariant.weight === rightVariant.weight &&
      leftVariant.isControl === rightVariant.isControl
    )
  })
}

const buildAutoPlaceDrafts = ({
  adLibrary,
  durationMs,
  markers,
}: {
  adLibrary: AdLibraryItem[]
  durationMs?: number
  markers: Marker[]
}) => {
  if (!durationMs) {
    return []
  }

  const availableAdAssetIds = adLibrary.map((ad) => ad.id)

  if (availableAdAssetIds.length === 0) {
    return []
  }

  const markerDraftTemplates = [
    {
      selectionMode: "static",
      selectedAdAssetIds: availableAdAssetIds.slice(0, 1),
    },
    {
      selectionMode: "auto",
      selectedAdAssetIds: availableAdAssetIds.slice(0, 3),
    },
    {
      selectionMode: "ab",
      selectedAdAssetIds: availableAdAssetIds.slice(3, 5),
    },
  ] satisfies Omit<MarkerDialogDraft, "requestedTimeMs">[]

  const plannedMarkers = [...markers]
  const idealTimeMsValues = [0.2, 0.5, 0.8].map((ratio) =>
    Math.round(durationMs * ratio)
  )

  return markerDraftTemplates.filter((draft) => {
    if (draft.selectionMode === "static") {
      return draft.selectedAdAssetIds.length === 1
    }

    if (draft.selectionMode === "ab") {
      return draft.selectedAdAssetIds.length >= 2
    }

    return draft.selectedAdAssetIds.length >= 1
  }).flatMap((draft, index) => {
    const requestedTimeMs = findOpenMarkerTimeMs({
      idealTimeMs: idealTimeMsValues[index] ?? 0,
      markers: plannedMarkers,
      durationMs,
    })

    if (requestedTimeMs === undefined) {
      return []
    }

    plannedMarkers.push({
      id: `planned-${index}`,
      requestedTimeMs,
      selectionMode: draft.selectionMode,
      status: "active",
      variants: [],
      playbackReadiness: { canPlay: true },
    })

    return [{ ...draft, requestedTimeMs }]
  })
}

const findOpenMarkerTimeMs = ({
  idealTimeMs,
  markers,
  durationMs,
}: {
  idealTimeMs: number
  markers: Marker[]
  durationMs?: number
}) => {
  if (!durationMs || durationMs < MARKER_DURATION_MS) {
    return undefined
  }

  const openIntervals = getOpenMarkerIntervals(markers, durationMs)

  if (openIntervals.length === 0) {
    return undefined
  }

  return openIntervals.reduce<number | undefined>((closestTimeMs, interval) => {
    const candidateTimeMs = clampTimeWithinInterval(idealTimeMs, interval)

    if (closestTimeMs === undefined) {
      return candidateTimeMs
    }

    return Math.abs(candidateTimeMs - idealTimeMs) <
      Math.abs(closestTimeMs - idealTimeMs)
      ? candidateTimeMs
      : closestTimeMs
  }, undefined)
}

const getOpenMarkerIntervals = (markers: Marker[], durationMs: number) => {
  const sortedMarkers = sortMarkers(markers)
  const intervals: Array<{ startMs: number; endMs: number }> = []
  let cursorMs = 0

  for (const marker of sortedMarkers) {
    const intervalEndMs = marker.requestedTimeMs - MARKER_DURATION_MS

    if (intervalEndMs >= cursorMs) {
      intervals.push({
        startMs: cursorMs,
        endMs: intervalEndMs,
      })
    }

    cursorMs = marker.requestedTimeMs + MARKER_DURATION_MS
  }

  const lastStartMs = durationMs - MARKER_DURATION_MS

  if (lastStartMs >= cursorMs) {
    intervals.push({
      startMs: cursorMs,
      endMs: lastStartMs,
    })
  }

  return intervals
}

const clampTimeWithinInterval = (
  timeMs: number,
  interval: { startMs: number; endMs: number }
) => {
  return Math.max(interval.startMs, Math.min(timeMs, interval.endMs))
}
