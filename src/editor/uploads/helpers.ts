import type { AdLibraryItem, EpisodeVideoAsset } from "../types"

export const sortAdLibrary = (adLibrary: AdLibraryItem[]) => {
  return [...adLibrary].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export const sortEpisodeVideoAssets = (
  episodeVideoAssets: EpisodeVideoAsset[]
) => {
  return [...episodeVideoAssets].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

// Note: expects the list sorted newest-first so this returns the most recent replacement candidate.
export const getReplacementEpisodeVideo = (
  episodeVideoAssets: EpisodeVideoAsset[],
  mainMediaAssetId?: string
) => {
  return episodeVideoAssets.find(
    (episodeVideoAsset) => episodeVideoAsset.mediaAsset.id !== mainMediaAssetId
  )
}
