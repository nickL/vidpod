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

import type {
  CreateMarkerInput,
  UpdateMarkerInput,
} from "./marker-mutations"
import type { StartPlaybackSessionInput } from "./playback-sessions"
import type { PlaybackEventInput } from "./types"

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
