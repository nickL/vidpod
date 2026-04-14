import { MARKER_DURATION_MS } from "../timeline/shared"

import type { Marker, MarkerVariant, MediaStatus } from "../types"

type PlaybackVariant = Pick<
  MarkerVariant,
  "id" | "adAssetId" | "status" | "weight" | "isControl"
> & {
  mediaStatus: MediaStatus
}

export type PlaybackMarker = Pick<
  Marker,
  "id" | "requestedTimeMs" | "selectionMode" | "status"
> & {
  variants: PlaybackVariant[]
}

const getActiveVariants = (variants: PlaybackVariant[]) =>
  variants.filter((variant) => variant.status === "active")

const getPlayableVariants = (variants: PlaybackVariant[]) =>
  variants.filter(
    (variant) => variant.status === "active" && variant.mediaStatus === "ready"
  )

export const canMarkerPlay = ({
  episodeDurationMs,
  marker,
}: {
  episodeDurationMs?: number
  marker: PlaybackMarker
}): boolean => {
  if (marker.status !== "active") {
    return false
  }

  const markerEndMs = marker.requestedTimeMs + MARKER_DURATION_MS

  if (episodeDurationMs !== undefined && markerEndMs > episodeDurationMs) {
    return false
  }

  const activeVariants = getActiveVariants(marker.variants)
  const playableVariants = getPlayableVariants(marker.variants)

  switch (marker.selectionMode) {
    case "static":
      return activeVariants.length === 1 && playableVariants.length === 1
    case "auto":
      return activeVariants.length >= 1 && playableVariants.length >= 1
    case "ab":
      return activeVariants.length >= 2 && playableVariants.length >= 2
  }
}

const pickUniformVariant = <Variant>(variants: Variant[], randomNumber: number) =>
  variants[Math.floor(randomNumber * variants.length)]

const pickWeightedVariant = (variants: PlaybackVariant[], randomNumber: number) => {
  const weightedVariants = variants.map((variant) => ({
    variant,
    weight:
      typeof variant.weight === "number" && variant.weight > 0
        ? variant.weight
        : 1,
  }))
  const totalWeight = weightedVariants.reduce(
    (sum, entry) => sum + entry.weight,
    0
  )
  let remainingWeight = randomNumber * totalWeight

  for (const entry of weightedVariants) {
    remainingWeight -= entry.weight

    if (remainingWeight < 0) {
      return entry.variant
    }
  }

  return weightedVariants[weightedVariants.length - 1]?.variant
}

export const resolveMarkerVariant = (
  marker: PlaybackMarker,
  getRandomNumber: () => number = Math.random
) => {
  const playableVariants = getPlayableVariants(marker.variants)

  if (playableVariants.length === 0) {
    return undefined
  }

  switch (marker.selectionMode) {
    case "static":
      return playableVariants[0]
    case "ab":
      return pickUniformVariant(playableVariants, getRandomNumber())
    case "auto": {
      const hasExplicitWeights = playableVariants.some(
        (variant) => typeof variant.weight === "number" && variant.weight > 0
      )

      if (!hasExplicitWeights) {
        return pickUniformVariant(playableVariants, getRandomNumber())
      }

      return pickWeightedVariant(playableVariants, getRandomNumber())
    }
  }
}
