"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"

import { formatDate } from "@/lib/utils"

import { AdLibraryDialog } from "./ad-library-dialog"
import { updateMarkerAction } from "./actions"
import { MarkerPanel } from "./marker-panel"
import { PlaybackSection } from "./playback-section"
import { episodeEditorQueryKey } from "./query-options"
import { useEpisodeEditor } from "./use-episode-editor"

import type { EditorData, Marker, MarkerActivation } from "./types"

type EpisodeEditorProps = {
  episodeId: string
}

type QueuedMarkerSave = {
  requestedTimeMs: number
  saveId: number
}

export const EpisodeEditor = ({
  episodeId,
}: EpisodeEditorProps) => {
  const queryClient = useQueryClient()
  const { data } = useEpisodeEditor(episodeId)
  const activeMarkerSaveIdsRef = useRef<Record<string, number>>({})
  const queuedMarkerSavesRef = useRef<Record<string, QueuedMarkerSave | undefined>>(
    {}
  )
  const nextSaveIdRef = useRef(0)
  const [adLibraryOpen, setAdLibraryOpen] = useState(false)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string>()
  const [markerActivation, setMarkerActivation] = useState<MarkerActivation>()
  const [pendingMarkerTimes, setPendingMarkerTimes] = useState<Record<string, number>>(
    {}
  )

  const setPendingMarkerTime = (markerId: string, requestedTimeMs: number) => {
    setPendingMarkerTimes((currentTimes) => ({
      ...currentTimes,
      [markerId]: requestedTimeMs,
    }))
  }

  const clearPendingMarkerTime = (markerId: string, requestedTimeMs: number) => {
    setPendingMarkerTimes((currentTimes) => {
      if (currentTimes[markerId] !== requestedTimeMs) {
        return currentTimes
      }

      const nextTimes = { ...currentTimes }

      delete nextTimes[markerId]
      return nextTimes
    })
  }

  const queryKey = episodeEditorQueryKey(episodeId)

  const saveMarkerInCache = useCallback(
    (updatedMarker: Marker) => {
      queryClient.setQueryData<EditorData>(queryKey, (currentData) => {
        if (!currentData) {
          return currentData
        }

        return {
          ...currentData,
          markers: sortMarkers(
            currentData.markers.map((marker) =>
              marker.id === updatedMarker.id ? updatedMarker : marker
            )
          ),
        }
      })
    },
    [queryClient, queryKey]
  )

  const saveQueuedMarkerTime = useCallback(
    async (markerId: string) => {
      const queuedSave = queuedMarkerSavesRef.current[markerId]

      if (!queuedSave) {
        return
      }

      delete queuedMarkerSavesRef.current[markerId]
      activeMarkerSaveIdsRef.current[markerId] = queuedSave.saveId

      try {
        const updatedMarker = await updateMarkerAction({
          markerId,
          requestedTimeMs: queuedSave.requestedTimeMs,
        })
        const hasNewerQueuedSave = queuedMarkerSavesRef.current[markerId] !== undefined

        if (!hasNewerQueuedSave) {
          saveMarkerInCache(updatedMarker)
          clearPendingMarkerTime(markerId, queuedSave.requestedTimeMs)
        }
      } catch {
        const hasNewerQueuedSave = queuedMarkerSavesRef.current[markerId] !== undefined

        if (!hasNewerQueuedSave) {
          clearPendingMarkerTime(markerId, queuedSave.requestedTimeMs)
        }
      } finally {
        if (activeMarkerSaveIdsRef.current[markerId] === queuedSave.saveId) {
          delete activeMarkerSaveIdsRef.current[markerId]
        }

        if (queuedMarkerSavesRef.current[markerId]) {
          void saveQueuedMarkerTime(markerId)
        }

        queryClient.invalidateQueries({ queryKey })
      }
    },
    [queryClient, queryKey, saveMarkerInCache]
  )

  const queueMarkerSave = useCallback(
    (markerId: string, requestedTimeMs: number) => {
      setPendingMarkerTime(markerId, requestedTimeMs)

      const saveId = nextSaveIdRef.current + 1

      nextSaveIdRef.current = saveId
      queuedMarkerSavesRef.current[markerId] = {
        requestedTimeMs,
        saveId,
      }

      if (activeMarkerSaveIdsRef.current[markerId] !== undefined) {
        return
      }

      void saveQueuedMarkerTime(markerId)
    },
    [saveQueuedMarkerTime]
  )

  const activateMarker = useCallback((markerId: string, requestedTimeMs: number) => {
    setSelectedMarkerId(markerId)
    setMarkerActivation({
      markerId,
      requestedTimeMs,
    })
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

  if (!data) {
    return null
  }

  const publishedDate = data.episode.publishedAt
    ? formatDate(data.episode.publishedAt)
    : "-"
  const subtitle = [data.episode.displayEpisodeNumber, publishedDate]
    .filter(Boolean)
    .join(" • ")

  return (
    <section className="min-h-full">
      <div className="flex max-w-176 flex-col gap-3">
        <p className="flex items-center gap-1 text-xs font-medium text-zinc-400">
          <ArrowLeft className="size-3" />
          Ads
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-[2rem] leading-[1.2] font-medium tracking-tight text-zinc-800">
            {data.episode.title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,26rem)_1fr] gap-8">
        <MarkerPanel
          markers={displayedMarkers}
          selectedMarkerId={selectedMarkerId}
          onEdit={() => setAdLibraryOpen(true)}
          onCreateMarker={() => setAdLibraryOpen(true)}
          onActivateMarker={activateMarker}
        />
        <PlaybackSection
          key={data.mainMediaAsset?.id ?? "missing-main-media"}
          title={data.episode.title}
          episodeDurationMs={data.episode.durationMs}
          mainMediaAsset={data.mainMediaAsset}
          markers={displayedMarkers}
          markerActivation={markerActivation}
          selectedMarkerId={selectedMarkerId}
          onMarkerTimeCommit={queueMarkerSave}
          onActivateMarker={activateMarker}
          onSelectMarker={setSelectedMarkerId}
        />
      </div>

      <AdLibraryDialog
        open={adLibraryOpen}
        onOpenChange={setAdLibraryOpen}
        adLibrary={data.adLibrary}
      />
    </section>
  )
}

const sortMarkers = (markers: Marker[]) => {
  return [...markers].sort(
    (leftMarker, rightMarker) =>
      leftMarker.requestedTimeMs - rightMarker.requestedTimeMs
  )
}
