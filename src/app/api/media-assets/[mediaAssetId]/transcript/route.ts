import { NextResponse } from "next/server"

import { getMediaTranscript } from "@/editor/transcript/transcript-records"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ mediaAssetId: string }>
}

export const GET = async (_request: Request, { params }: RouteContext) => {
  const { mediaAssetId } = await params
  const transcript = await getMediaTranscript(mediaAssetId)

  if (!transcript) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  return NextResponse.json(transcript)
}
