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
