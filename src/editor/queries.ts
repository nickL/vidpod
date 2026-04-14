import { queryOptions } from "@tanstack/react-query"

import type { EditorData } from "./types"

export const getEpisodeEditorUrl = (episodeId: string) => {
  return `/api/episodes/${episodeId}/editor`
}

export const fetchEpisodeEditor = async (episodeId: string) => {
  const response = await fetch(getEpisodeEditorUrl(episodeId))

  if (!response.ok) {
    throw new Error("Uh ohs - error loading data for editor")
  }

  return response.json() as Promise<EditorData>
}

export const episodeEditorQueryKey = (episodeId: string) => {
  return ["episode-editor", episodeId] as const
}

export const episodeEditorQueryOptions = (episodeId: string) => {
  return queryOptions({
    queryKey: episodeEditorQueryKey(episodeId),
    queryFn: () => fetchEpisodeEditor(episodeId),
  })
}
