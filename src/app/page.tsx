import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

import { EpisodeEditor } from "@/editor/episode-editor"
import { episodeEditorQueryKey } from "@/editor/query-options"
import {
  getDefaultEpisodeId,
  getEpisodeEditor,
} from "@/editor/editor-data"
import { serverEnv } from "@/env/server"
import { getQueryClient } from "@/lib/query-client"

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
      <EpisodeEditor
        episodeId={episodeId}
        hlsBaseUrl={serverEnv.hlsWorkerPublicBaseUrl ?? undefined}
      />
    </HydrationBoundary>
  )
}

export default Home
