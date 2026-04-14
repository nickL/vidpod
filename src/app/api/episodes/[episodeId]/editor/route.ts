import { NextResponse } from "next/server"

import { getEpisodeEditor } from "@/features/episode-editor/server"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    episodeId: string
  }>
}

export const GET = async (_request: Request, { params }: RouteContext) => {
  const { episodeId } = await params

  try {
    const data = await getEpisodeEditor(episodeId)

    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { message: "Episode editor data not found" },
      { status: 404 }
    )
  }
}
