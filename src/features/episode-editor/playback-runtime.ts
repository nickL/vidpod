import { MARKER_DURATION_MS } from "./timeline/shared"

import type {
  Marker,
  MarkerPlaybackReadiness,
  MarkerPlaybackReasonCode,
  MarkerPlaybackReasonSeverity,
  MarkerVariant,
  MediaStatus,
} from "./types"

type PlaybackVariant = Pick<
  MarkerVariant,
  "id" | "status" | "weight" | "isControl"
> & {
  mediaStatus: MediaStatus
}

export type PlaybackMarker = Pick<
  Marker,
  "id" | "requestedTimeMs" | "selectionMode" | "status"
> & {
  variants: PlaybackVariant[]
}

const getReadinessSeverity = (
  markerStatus: Marker["status"]
): MarkerPlaybackReasonSeverity => {
  return markerStatus === "draft" ? "guidance" : "warning"
}

const createPlaybackReadiness = ({
  canPlay,
  markerStatus,
  reasonCode,
}: {
  canPlay: boolean
  markerStatus: Marker["status"]
  reasonCode?: MarkerPlaybackReasonCode
}): MarkerPlaybackReadiness => {
  if (!reasonCode) {
    return {
      canPlay,
    }
  }

  return {
    canPlay,
    reasonCode,
    reasonSeverity: getReadinessSeverity(markerStatus),
  }
}

const isVariantActive = (variant: PlaybackVariant) => {
  return variant.status === "active"
}

const isVariantPlayable = (variant: PlaybackVariant) => {
  return isVariantActive(variant) && variant.mediaStatus === "ready"
}

const getPlayableVariants = (variants: PlaybackVariant[]) => {
  return variants.filter(isVariantPlayable)
}

const getActiveVariants = (variants: PlaybackVariant[]) => {
  return variants.filter(isVariantActive)
}

const getStaticMarkerReadiness = ({
  activeVariants,
  markerStatus,
  playableVariants,
}: {
  activeVariants: PlaybackVariant[]
  markerStatus: Marker["status"]
  playableVariants: PlaybackVariant[]
}) => {
  if (activeVariants.length === 0) {
    return createPlaybackReadiness({
      canPlay: false,
      markerStatus,
      reasonCode: "needs_variant",
    })
  }

  if (activeVariants.length !== 1) {
    return createPlaybackReadiness({
      canPlay: false,
      markerStatus,
      reasonCode: "invalid_static_variant_count",
    })
  }

  if (playableVariants.length !== 1) {
    return createPlaybackReadiness({
      canPlay: false,
      markerStatus,
      reasonCode: "asset_unavailable",
    })
  }

  return createPlaybackReadiness({
    canPlay: markerStatus === "active",
    markerStatus,
  })
}

const getAutoMarkerReadiness = ({
  activeVariants,
  markerStatus,
  playableVariants,
}: {
  activeVariants: PlaybackVariant[]
  markerStatus: Marker["status"]
  playableVariants: PlaybackVariant[]
}) => {
  if (activeVariants.length === 0) {
    return createPlaybackReadiness({
      canPlay: false,
      markerStatus,
      reasonCode: "needs_variant",
    })
  }

  if (playableVariants.length === 0) {
    return createPlaybackReadiness({
      canPlay: false,
      markerStatus,
      reasonCode: "asset_unavailable",
    })
  }

  return createPlaybackReadiness({
    canPlay: markerStatus === "active",
    markerStatus,
  })
}

const getAbMarkerReadiness = ({
  activeVariants,
  markerStatus,
  playableVariants,
}: {
  activeVariants: PlaybackVariant[]
  markerStatus: Marker["status"]
  playableVariants: PlaybackVariant[]
}) => {
  if (activeVariants.length < 2) {
    return createPlaybackReadiness({
      canPlay: false,
      markerStatus,
      reasonCode: "needs_more_variants_for_ab",
    })
  }

  if (playableVariants.length < 2) {
    return createPlaybackReadiness({
      canPlay: false,
      markerStatus,
      reasonCode: "asset_unavailable",
    })
  }

  return createPlaybackReadiness({
    canPlay: markerStatus === "active",
    markerStatus,
  })
}

export const getMarkerPlaybackReadiness = ({
  episodeDurationMs,
  marker,
}: {
  episodeDurationMs?: number
  marker: PlaybackMarker
}): MarkerPlaybackReadiness => {
  const markerEndMs = marker.requestedTimeMs + MARKER_DURATION_MS

  if (
    episodeDurationMs !== undefined &&
    markerEndMs > episodeDurationMs
  ) {
    return createPlaybackReadiness({
      canPlay: false,
      markerStatus: marker.status,
      reasonCode: "invalid_break_time",
    })
  }

  const activeVariants = getActiveVariants(marker.variants)
  const playableVariants = getPlayableVariants(marker.variants)

  switch (marker.selectionMode) {
    case "static":
      return getStaticMarkerReadiness({
        activeVariants,
        markerStatus: marker.status,
        playableVariants,
      })
    case "auto":
      return getAutoMarkerReadiness({
        activeVariants,
        markerStatus: marker.status,
        playableVariants,
      })
    case "ab":
      return getAbMarkerReadiness({
        activeVariants,
        markerStatus: marker.status,
        playableVariants,
      })
  }
}

const pickUniformVariant = <Variant>(
  variants: Variant[],
  randomNumber: number
) => {
  return variants[Math.floor(randomNumber * variants.length)]
}

const pickWeightedVariant = (
  variants: PlaybackVariant[],
  randomNumber: number
) => {
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
