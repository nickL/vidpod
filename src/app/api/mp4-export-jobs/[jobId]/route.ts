import { NextResponse } from "next/server"

import { getMp4ExportJob } from "@/editor/mp4-export-jobs"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ jobId: string }>
}

export const GET = async (_request: Request, { params }: RouteContext) => {
  const { jobId } = await params
  const job = await getMp4ExportJob(jobId)

  if (!job) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  return NextResponse.json(job)
}
