import { NextResponse } from "next/server"

import { serverEnv } from "@/env/server"
import {
  applyMp4ExportJobStateUpdate,
  isMp4Artifact,
  type Mp4ExportJobStateUpdate,
} from "@/editor/mp4-export-jobs"
import { isMp4ExportJobPhase } from "@/editor/mp4-export/phases"

export const dynamic = "force-dynamic"

const asObject = (value: unknown) =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null

const parseUpdate = (value: unknown): Mp4ExportJobStateUpdate | null => {
  const payload = asObject(value)

  if (!payload || typeof payload.jobId !== "string" || typeof payload.event !== "string") {
    return null
  }

  switch (payload.event) {
    case "processing":
    case "progress":
      return isMp4ExportJobPhase(payload.phase)
        ? (payload as Mp4ExportJobStateUpdate)
        : null
    case "ready":
      return isMp4Artifact(payload.output)
        ? (payload as Mp4ExportJobStateUpdate)
        : null
    case "failed":
      return typeof payload.error === "string"
        ? (payload as Mp4ExportJobStateUpdate)
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

  const result = await applyMp4ExportJobStateUpdate(payload)

  return NextResponse.json(result)
}
