import { NextResponse } from "next/server"

import { serverEnv } from "@/env/server"
import {
  updateWaveformState,
  type WaveformStateUpdate,
} from "@/editor/waveforms/waveform-jobs"

export const dynamic = "force-dynamic"

const asObject = (value: unknown) =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === "number")

const parseUpdate = (value: unknown): WaveformStateUpdate | null => {
  const payload = asObject(value)

  if (
    !payload ||
    typeof payload.mediaAssetId !== "string" ||
    typeof payload.event !== "string"
  ) {
    return null
  }

  switch (payload.event) {
    case "processing":
      return payload as WaveformStateUpdate
    case "ready":
      return typeof payload.bucketCount === "number" && isNumberArray(payload.peaks)
        ? (payload as WaveformStateUpdate)
        : null
    case "failed":
      return typeof payload.error === "string"
        ? (payload as WaveformStateUpdate)
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
    return NextResponse.json(
      { error: "Invalid waveform state update payload." },
      { status: 400 }
    )
  }

  await updateWaveformState(payload)

  return NextResponse.json({ ok: true })
}
