import { NextResponse } from "next/server"

import { getMp4ExportDownloadUrl } from "@/editor/mp4-export-jobs"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ jobId: string }>
}

export const GET = async (_request: Request, { params }: RouteContext) => {
  const { jobId } = await params
  const downloadHref = await getMp4ExportDownloadUrl(jobId)

  if (!downloadHref) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  return NextResponse.redirect(downloadHref)
}
