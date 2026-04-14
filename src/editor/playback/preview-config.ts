import type { Marker } from "../types"

// Note: used as the PlaybackSection `key` prop to force a remount when anything in the config changes.
export const getPreviewConfigKey = (
  markers: Marker[],
  mainMediaAssetId?: string
) => {
  return JSON.stringify({
    mainMediaAssetId: mainMediaAssetId ?? null,
    markers: markers.map((marker) => ({
      id: marker.id,
      requestedTimeMs: marker.requestedTimeMs,
      selectionMode: marker.selectionMode,
      status: marker.status,
      variants: marker.variants.map((variant) => ({
        id: variant.id,
        adAssetId: variant.adAssetId,
        status: variant.status,
        weight: variant.weight,
        isControl: variant.isControl,
      })),
    })),
  })
}
