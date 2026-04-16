import { NextResponse } from "next/server"

import { serverEnv } from "@/env/server"
import {
  isMp4Artifact,
  reconcileMp4ExportJob,
} from "@/editor/mp4-export-jobs"

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

export const POST = async (request: Request, { params }: RouteContext) => {
  if (!serverEnv.mediaJobsToken) {
    return NextResponse.json(
      { error: "MEDIA_JOBS_TOKEN is not configured." },
      { status: 500 }
    )
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as
    | { artifact?: unknown }
    | null
  const artifact = body?.artifact

  if (!isMp4Artifact(artifact)) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const { jobId } = await params
  const result = await reconcileMp4ExportJob({ jobId, artifact })

  return NextResponse.json(result)
}
