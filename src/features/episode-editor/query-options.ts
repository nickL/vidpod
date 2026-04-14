import { queryOptions } from "@tanstack/react-query"

import { fetchEpisodeEditor } from "./api"

export const episodeEditorQueryKey = (episodeId: string) => {
  return ["episode-editor", episodeId] as const
}

export const episodeEditorQueryOptions = (episodeId: string) => {
  return queryOptions({
    queryKey: episodeEditorQueryKey(episodeId),
    queryFn: () => fetchEpisodeEditor(episodeId),
  })
}
