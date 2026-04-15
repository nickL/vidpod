import { NextResponse } from "next/server"

import { serverEnv } from "@/env/server"
import {
  updateTranscriptJobState,
  type TranscriptJobStateUpdate,
} from "@/editor/transcript/transcript-jobs"
import { isTranscriptJobPhase } from "@/editor/transcript/phases"

export const dynamic = "force-dynamic"

const asObject = (value: unknown) =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null

const isWordsArtifact = (value: unknown) => {
  const artifact = asObject(value)

  return (
    !!artifact &&
    artifact.storage === "r2" &&
    artifact.contentType === "application/json" &&
    typeof artifact.key === "string" &&
    typeof artifact.fileName === "string"
  )
}

const isOptionalNumber = (value: unknown) =>
  value === undefined || typeof value === "number"

const parseUpdate = (value: unknown): TranscriptJobStateUpdate | null => {
  const payload = asObject(value)

  if (!payload || typeof payload.jobId !== "string" || typeof payload.event !== "string") {
    return null
  }

  switch (payload.event) {
    case "processing":
      return payload.phase === "extracting" && typeof payload.totalChunks === "number"
        ? (payload as TranscriptJobStateUpdate)
        : null
    case "progress":
      return isTranscriptJobPhase(payload.phase) &&
          isOptionalNumber(payload.totalChunks) &&
          isOptionalNumber(payload.completedChunks)
        ? (payload as TranscriptJobStateUpdate)
        : null
    case "ready":
      return typeof payload.text === "string" && isWordsArtifact(payload.wordsArtifact)
        ? (payload as TranscriptJobStateUpdate)
        : null
    case "failed":
      return typeof payload.error === "string"
        ? (payload as TranscriptJobStateUpdate)
        : null
    default:
      return null
  }
}

const isAuthorized = (request: Request) => {
  const mediaJobsToken = serverEnv.mediaJobsToken

  if (!mediaJobsToken) {
    return false
  }

  return request.headers.get("authorization") === `Bearer ${mediaJobsToken}`
}

export const POST = async (request: Request) => {
  if (!serverEnv.mediaJobsToken) {
    return NextResponse.json(
      { error: "MEDIA_JOBS_TOKEN is not configured." },
      { status: 500 }
    )
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = parseUpdate(await request.json().catch(() => null))

  if (!payload) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
  }

  const result = await updateTranscriptJobState(payload)

  return NextResponse.json(result)
}
