import { v5 as uuidv5 } from "uuid"

const seedNamespace = uuidv5("vidpod-seed", uuidv5.DNS)

const createSeedId = (key: string) => {
  return uuidv5(key, seedNamespace)
}

export const demoEpisodeId = createSeedId("episode")
export const demoEpisodeMediaAssetId = createSeedId("media:episode")

export const isDemoEpisode = (episodeId: string) => {
  return episodeId === demoEpisodeId
}
