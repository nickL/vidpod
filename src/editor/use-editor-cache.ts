"use client"

import { useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { sortMarkers } from "./markers/helpers"
import { episodeEditorQueryKey } from "./queries"
import { sortAdLibrary, sortEpisodeVideoAssets } from "./uploads/helpers"

import type {
  AdLibraryItem,
  EditorData,
  EpisodeVideoAsset,
  Marker,
  UploadProgressState,
} from "./types"

export const useEditorCache = (episodeId: string) => {
  const queryClient = useQueryClient()
  const queryKey = episodeEditorQueryKey(episodeId)

  return useMemo(() => {
    const update = (updater: (current: EditorData) => EditorData) => {
      queryClient.setQueryData<EditorData>(queryKey, (currentData) =>
        currentData ? updater(currentData) : currentData
      )
    }

    const upsert = <T extends { id: string }>(items: T[], item: T) => {
      return items.some((currentItem) => currentItem.id === item.id)
        ? items.map((currentItem) =>
            currentItem.id === item.id ? item : currentItem
          )
        : [...items, item]
    }

    return {
      markers: {
        replace: (markers: Marker[]) => {
          update((currentData) => ({
            ...currentData,
            markers: sortMarkers(markers),
          }))
        },
        save: (marker: Marker) => {
          update((currentData) => ({
            ...currentData,
            markers: sortMarkers(upsert(currentData.markers, marker)),
          }))
        },
        remove: (markerId: string) => {
          update((currentData) => ({
            ...currentData,
            markers: currentData.markers.filter(
              (marker) => marker.id !== markerId
            ),
          }))
        },
      },
      episodeVideos: {
        save: (episodeVideo: EpisodeVideoAsset) => {
          update((currentData) => ({
            ...currentData,
            episodeVideoAssets: sortEpisodeVideoAssets(
              upsert(currentData.episodeVideoAssets, episodeVideo)
            ),
          }))
        },
        remove: (episodeVideoAssetId: string) => {
          update((currentData) => ({
            ...currentData,
            episodeVideoAssets: currentData.episodeVideoAssets.filter(
              (episodeVideo) => episodeVideo.id !== episodeVideoAssetId
            ),
          }))
        },
      },
      adLibrary: {
        save: (adLibraryItem: AdLibraryItem) => {
          update((currentData) => ({
            ...currentData,
            adLibrary: sortAdLibrary(upsert(currentData.adLibrary, adLibraryItem)),
          }))
        },
      },
      mainVideo: {
        // Note: episode.durationMs tracks the main video's length, so keeping them in sync when the main video changes.
        save: (mainMediaAsset: EditorData["mainMediaAsset"]) => {
          update((currentData) => ({
            ...currentData,
            episode: {
              ...currentData.episode,
              durationMs:
                mainMediaAsset?.durationMs ?? currentData.episode.durationMs,
            },
            mainMediaAsset,
          }))
        },
      },
      mediaAssets: {
        setStatus: (
          mediaAssetId: string,
          status: UploadProgressState["phase"] | "failed"
        ) => {
          update((currentData) => ({
            ...currentData,
            mainMediaAsset:
              currentData.mainMediaAsset?.id === mediaAssetId
                ? { ...currentData.mainMediaAsset, status }
                : currentData.mainMediaAsset,
            adLibrary: currentData.adLibrary.map((adLibraryItem) =>
              adLibraryItem.mediaAsset.id === mediaAssetId
                ? {
                    ...adLibraryItem,
                    mediaAsset: { ...adLibraryItem.mediaAsset, status },
                  }
                : adLibraryItem
            ),
            episodeVideoAssets: currentData.episodeVideoAssets.map(
              (episodeVideo) =>
                episodeVideo.mediaAsset.id === mediaAssetId
                  ? {
                      ...episodeVideo,
                      mediaAsset: { ...episodeVideo.mediaAsset, status },
                    }
                  : episodeVideo
            ),
          }))
        },
      },
    }
  }, [queryClient, queryKey])
}
