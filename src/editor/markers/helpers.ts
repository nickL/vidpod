import { MARKER_DURATION_MS } from "../timeline/shared"

import type { Marker, MarkerVariant } from "../types"

type MarkerSelectionDraft = {
  selectionMode: Marker["selectionMode"]
  selectedAdAssetIds: string[]
}

export const sortMarkers = (markers: Marker[]) => {
  return [...markers].sort(
    (leftMarker, rightMarker) =>
      leftMarker.requestedTimeMs - rightMarker.requestedTimeMs
  )
}

export const buildVariantInputs = ({
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

const toVariantInput = (variant: MarkerVariant) => {
  return {
    adAssetId: variant.adAssetId,
    weight: variant.weight,
    isControl: variant.isControl,
    status: variant.status,
  }
}

export const toUpdateMarkerInput = (marker: Marker) => ({
  markerId: marker.id,
  requestedTimeMs: marker.requestedTimeMs,
  selectionMode: marker.selectionMode,
  status: marker.status,
  label: marker.label,
  variants: marker.variants.map(toVariantInput),
})

export const toCreateMarkerInput = (episodeId: string, marker: Marker) => ({
  ...toUpdateMarkerInput(marker),
  episodeId,
})

export const matchesMarkerDraft = (
  marker: Marker,
  draft: MarkerSelectionDraft
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

export const matchesMarkerState = (leftMarker: Marker, rightMarker: Marker) => {
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

export const buildAutoPlaceDrafts = ({
  adLibraryIds,
  durationMs,
  markers,
}: {
  adLibraryIds: string[]
  durationMs?: number
  markers: Marker[]
}) => {
  if (!durationMs || adLibraryIds.length === 0) {
    return []
  }

  const draftTemplates = [
    {
      selectionMode: "static",
      selectedAdAssetIds: adLibraryIds.slice(0, 1),
    },
    {
      selectionMode: "auto",
      selectedAdAssetIds: adLibraryIds.slice(0, 3),
    },
    {
      selectionMode: "ab",
      selectedAdAssetIds: adLibraryIds.slice(3, 5),
    },
  ] satisfies MarkerSelectionDraft[]

  const plannedMarkers = [...markers]
  // Note: one static, one auto, one A/B, placed roughly at 20%, 50%, 80% through the episode.
  const idealTimeMsValues = [0.2, 0.5, 0.8].map((ratio) =>
    Math.round(durationMs * ratio)
  )

  return draftTemplates
    .filter((draft) => {
      if (draft.selectionMode === "static") {
        return draft.selectedAdAssetIds.length === 1
      }

      if (draft.selectionMode === "ab") {
        return draft.selectedAdAssetIds.length >= 2
      }

      return draft.selectedAdAssetIds.length >= 1
    })
    .flatMap((draft, index) => {
      const requestedTimeMs = findOpenMarkerTimeMs({
        idealTimeMs: idealTimeMsValues[index] ?? 0,
        markers: plannedMarkers,
        durationMs,
      })

      if (requestedTimeMs === undefined) {
        return []
      }

      // Note: push into plannedMarkers as we go so the next slot search treats this one as taken.
      plannedMarkers.push({
        id: `planned-${index}`,
        requestedTimeMs,
        selectionMode: draft.selectionMode,
        status: "active",
        variants: [],
        canPlay: true,
      })

      return [{ ...draft, requestedTimeMs }]
    })
}

export const findOpenMarkerTimeMs = ({
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

export const getOpenMarkerIntervals = (
  markers: Marker[],
  durationMs: number
) => {
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

export const clampTimeWithinInterval = (
  timeMs: number,
  interval: { startMs: number; endMs: number }
) => {
  return Math.max(interval.startMs, Math.min(timeMs, interval.endMs))
}
