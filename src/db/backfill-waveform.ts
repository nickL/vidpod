import "dotenv/config"

import { db } from "./client"
import { mediaWaveforms } from "./schema"

type WaveformResponse = {
  bucketCount: number
  durationMs: number
  peaks: number[]
}

const requireEnv = (name: string) => {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}

const backfillWaveform = async () => {
  const transcoderUrl = requireEnv("TRANSCODER_URL").replace(/\/$/, "")
  const transcoderAuthToken = requireEnv("TRANSCODER_AUTH_TOKEN")
  const mediaAssetId = requireEnv("MEDIA_ASSET_ID")
  const sourceUrl = requireEnv("SOURCE_URL")
  const bucketCount = Number(process.env.BUCKET_COUNT ?? "1024")

  const response = await fetch(`${transcoderUrl}/waveforms`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${transcoderAuthToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sourceUrl,
      bucketCount,
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | WaveformResponse
    | { error?: string }
    | null

  if (!response.ok || !payload || !("peaks" in payload)) {
    const errorMessage =
      payload && "error" in payload && payload.error
        ? payload.error
        : "Waveform generation failed"

    throw new Error(errorMessage)
  }

  const now = new Date()

  await db
    .insert(mediaWaveforms)
    .values({
      mediaAssetId,
      status: "ready",
      peaks: payload.peaks,
      bucketCount: payload.bucketCount,
      lastError: null,
      requestedAt: now,
      startedAt: now,
      completedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: mediaWaveforms.mediaAssetId,
      set: {
        status: "ready",
        peaks: payload.peaks,
        bucketCount: payload.bucketCount,
        lastError: null,
        requestedAt: now,
        startedAt: now,
        completedAt: now,
        updatedAt: now,
      },
    })

  console.log(
    JSON.stringify(
      {
        mediaAssetId,
        bucketCount: payload.bucketCount,
        durationMs: payload.durationMs,
        peakCount: payload.peaks.length,
      },
      null,
      2
    )
  )
}

backfillWaveform().catch((error) => {
  console.error(error)
  process.exit(1)
})
