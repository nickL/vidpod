import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

import { EpisodeEditor } from "@/features/episode-editor/episode-editor"
import { episodeEditorQueryKey } from "@/features/episode-editor/query-options"
import {
  getDefaultEpisodeId,
  getEpisodeEditor,
} from "@/features/episode-editor/server"
import { getQueryClient } from "@/lib/react-query/get-query-client"

export const dynamic = "force-dynamic"

const Home = async () => {
  const episodeId = await getDefaultEpisodeId()

  if (!episodeId) {
    return null
  }

  const queryClient = getQueryClient()
  const data = await getEpisodeEditor(episodeId)

  queryClient.setQueryData(episodeEditorQueryKey(episodeId), data)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <EpisodeEditor episodeId={episodeId} />
    </HydrationBoundary>
  )
}

export default Home
