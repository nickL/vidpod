import { NextResponse } from "next/server"

import { serverEnv } from "@/env/server"
import { getHlsPlan } from "@/editor/playback/playback-sessions"

export const dynamic = "force-dynamic"

const isAuthorized = (request: Request) => {
  const mediaJobsToken = serverEnv.mediaJobsToken

  if (!mediaJobsToken) {
    return false
  }

  return request.headers.get("authorization") === `Bearer ${mediaJobsToken}`
}

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ playbackSessionId: string }> }
) => {
  if (!serverEnv.mediaJobsToken) {
    return NextResponse.json(
      { error: "MEDIA_JOBS_TOKEN is not configured." },
      { status: 500 }
    )
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { playbackSessionId } = await params

  try {
    const manifestPlan = await getHlsPlan(playbackSessionId)

    return NextResponse.json(manifestPlan)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load HLS manifest plan.",
      },
      { status: 404 }
    )
  }
}
