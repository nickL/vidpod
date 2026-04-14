"use server"

import {
  createMarker,
  deleteMarker,
  updateMarker,
} from "./marker-mutations"

import type {
  CreateMarkerInput,
  UpdateMarkerInput,
} from "./marker-mutations"

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
