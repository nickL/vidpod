"use server"

import {
  createMarker,
  deleteMarker,
  updateMarker,
} from "./marker-mutations"
import {
  recordPlaybackEvent,
  startPlaybackSession,
} from "./playback-sessions"
import { generateMp4Export } from "./mp4-export"
import {
  failUpload,
  resetDemoEpisode,
  removeEpisodeVideo,
  refreshUploadedAsset,
  setCurrentEpisodeVideo,
  startUpload,
} from "./uploads"

import type {
  CreateMarkerInput,
  UpdateMarkerInput,
} from "./marker-mutations"
import type { StartPlaybackSessionInput } from "./playback-sessions"
import type { EpisodeVideoAsset, PlaybackEventInput } from "./types"
import type { UploadInitInput, UploadTarget } from "./types"

export const createMarkerAction = async (
  input: CreateMarkerInput
) => {
  return createMarker(input)
}

export const updateMarkerAction = async (
  input: UpdateMarkerInput
) => {
  return updateMarker(input)
}

export const deleteMarkerAction = async (markerId: string) => {
  return deleteMarker(markerId)
}

export const startPlaybackSessionAction = async (
  input: StartPlaybackSessionInput
) => {
  return startPlaybackSession(input)
}

export const recordPlaybackEventAction = async (
  input: PlaybackEventInput
) => {
  return recordPlaybackEvent(input)
}

export const generateMp4ExportAction = async (
  playbackSessionId: string
) => {
  return generateMp4Export(playbackSessionId)
}

export const startUploadAction = async (input: UploadInitInput) => {
  return startUpload(input)
}

export const refreshUploadedAssetAction = async ({
  target,
  assetId,
}: {
  target: UploadTarget
  assetId: string
}) => {
  if (target === "episode") {
    const result = (await refreshUploadedAsset({
      target: "episode",
      assetId,
    })) as {
      episodeId: string
      episodeVideoAsset: EpisodeVideoAsset
    }

    return {
      target,
      episodeVideoAsset: result.episodeVideoAsset,
    }
  }

  const result = await refreshUploadedAsset({
    target: "ad",
    assetId,
  })

  return {
    target,
    adLibraryItem: result,
  }
}

export const failUploadAction = async (mediaAssetId: string) => {
  return failUpload(mediaAssetId)
}

export const removeEpisodeVideoAction = async (
  episodeVideoAssetId: string
) => {
  return removeEpisodeVideo(episodeVideoAssetId)
}

export const setCurrentEpisodeVideoAction = async (
  episodeVideoAssetId: string
) => {
  return setCurrentEpisodeVideo(episodeVideoAssetId)
}

export const resetDemoEpisodeAction = async (episodeId: string) => {
  return resetDemoEpisode(episodeId)
}
