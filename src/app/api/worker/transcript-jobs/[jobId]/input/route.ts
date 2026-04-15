import { NextResponse } from "next/server"

import { serverEnv } from "@/env/server"
import { getTranscriptJobInput } from "@/editor/transcript/transcript-job-input"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ jobId: string }>
}

const isAuthorized = (request: Request) => {
  const mediaJobsToken = serverEnv.mediaJobsToken

  if (!mediaJobsToken) {
    return false
  }

  return request.headers.get("authorization") === `Bearer ${mediaJobsToken}`
}

export const GET = async (request: Request, { params }: RouteContext) => {
  if (!serverEnv.mediaJobsToken) {
    return NextResponse.json(
      { error: "MEDIA_JOBS_TOKEN is not configured." },
      { status: 500 }
    )
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { jobId } = await params
  const input = await getTranscriptJobInput(jobId)

  if (!input) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  return NextResponse.json(input)
}
