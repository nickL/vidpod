import { NextResponse } from "next/server"

import { serverEnv } from "@/env/server"
import {
  applyWaveformStateUpdate,
  type WaveformStateUpdate,
} from "@/editor/waveform-jobs"

export const dynamic = "force-dynamic"

const isAuthorized = (request: Request) => {
  const mediaJobsToken = serverEnv.mediaJobsToken

  if (!mediaJobsToken) {
    return false
  }

  return request.headers.get("authorization") === `Bearer ${mediaJobsToken}`
}

const isWaveformStateUpdate = (value: unknown): value is WaveformStateUpdate => {
  if (!value || typeof value !== "object") {
    return false
  }

  const payload = value as Record<string, unknown>

  if (typeof payload.mediaAssetId !== "string") {
    return false
  }

  if (payload.event === "processing") {
    return true
  }

  if (
    payload.event === "ready" &&
    typeof payload.bucketCount === "number" &&
    Array.isArray(payload.peaks) &&
    payload.peaks.every((peak) => typeof peak === "number")
  ) {
    return true
  }

  if (payload.event === "failed" && typeof payload.error === "string") {
    return true
  }

  return false
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

  const payload = await request.json().catch(() => null)

  if (!isWaveformStateUpdate(payload)) {
    return NextResponse.json(
      { error: "Invalid waveform state update payload." },
      { status: 400 }
    )
  }

  await applyWaveformStateUpdate(payload)

  return NextResponse.json({ ok: true })
}
