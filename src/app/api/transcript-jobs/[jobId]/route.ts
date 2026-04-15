import { NextResponse } from "next/server"

import { getTranscriptJob } from "@/editor/transcript/transcript-jobs"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ jobId: string }>
}

export const GET = async (_request: Request, { params }: RouteContext) => {
  const { jobId } = await params
  const job = await getTranscriptJob(jobId)

  if (!job) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  return NextResponse.json(job)
}
