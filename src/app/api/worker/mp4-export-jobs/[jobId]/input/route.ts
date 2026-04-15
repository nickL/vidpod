import { NextResponse } from "next/server"

import { serverEnv } from "@/env/server"
import { getMp4ExportJobInput } from "@/editor/mp4-export-jobs"

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
  const input = await getMp4ExportJobInput(jobId)

  if (!input) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  return NextResponse.json(input)
}
