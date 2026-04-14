import "server-only"

import { db } from "@/db"
import { mediaWaveforms } from "@/db/schema"
import { serverEnv } from "@/env/server"

import type { MediaWaveform } from "../types"

const DEFAULT_WAVEFORM_BUCKET_COUNT = 1024

type GenerateWaveformJob = {
  jobType: "generate_waveform"
  mediaAssetId: string
  sourceUrl: string
  bucketCount: number
}

type ProcessingWaveformUpdate = {
  event: "processing"
  mediaAssetId: string
}

type ReadyWaveformUpdate = {
  event: "ready"
  mediaAssetId: string
  peaks: number[]
  bucketCount: number
}

type FailedWaveformUpdate = {
  event: "failed"
  mediaAssetId: string
  error: string
}

export type WaveformStateUpdate =
  | ProcessingWaveformUpdate
  | ReadyWaveformUpdate
  | FailedWaveformUpdate

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  return error instanceof Error && error.message
    ? error.message
    : fallbackMessage
}

const toMediaWaveform = ({
  status,
  peaks,
  bucketCount,
  lastError,
}: {
  status: MediaWaveform["status"]
  peaks?: number[] | null
  bucketCount?: number | null
  lastError?: string | null
}) => {
  return {
    status,
    peaks: peaks ?? undefined,
    bucketCount: bucketCount ?? undefined,
    lastError: lastError ?? undefined,
  } satisfies MediaWaveform
}

const enqueueWaveformJob = async (job: GenerateWaveformJob) => {
  const workerBaseUrl = serverEnv.cloudflareWorkerPublicBaseUrl
  const mediaJobsToken = serverEnv.mediaJobsToken

  if (!workerBaseUrl || !mediaJobsToken) {
    throw new Error("Cloudflare media jobs worker is not configured")
  }

  const response = await fetch(
    `${workerBaseUrl.replace(/\/$/, "")}/enqueue-waveform`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${mediaJobsToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(job),
      cache: "no-store",
    }
  )
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null

  if (!response.ok) {
    throw new Error(payload?.error || "Unable to enqueue waveform job")
  }
}

const upsertWaveformState = async ({
  mediaAssetId,
  insert,
  update,
}: {
  mediaAssetId: string
  insert: Omit<typeof mediaWaveforms.$inferInsert, "mediaAssetId">
  update: Partial<typeof mediaWaveforms.$inferInsert>
}) => {
  await db
    .insert(mediaWaveforms)
    .values({ mediaAssetId, ...insert })
    .onConflictDoUpdate({
      target: mediaWaveforms.mediaAssetId,
      set: update,
    })
}

export const markWaveformPending = async (mediaAssetId: string) => {
  const now = new Date()
  const updateFields = {
    status: "pending" as const,
    peaks: null,
    bucketCount: null,
    lastError: null,
    requestedAt: now,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  }

  await upsertWaveformState({
    mediaAssetId,
    insert: { ...updateFields, createdAt: now },
    update: updateFields,
  })
}

export const saveWaveformEnqueueError = async ({
  mediaAssetId,
  error,
}: {
  mediaAssetId: string
  error: string
}) => {
  const now = new Date()

  await upsertWaveformState({
    mediaAssetId,
    insert: {
      status: "pending",
      peaks: null,
      bucketCount: null,
      lastError: error,
      requestedAt: now,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      status: "pending",
      lastError: error,
      updatedAt: now,
    },
  })
}

export const markWaveformProcessing = async (mediaAssetId: string) => {
  const now = new Date()
  const updateFields = {
    status: "processing" as const,
    peaks: null,
    bucketCount: null,
    lastError: null,
    startedAt: now,
    completedAt: null,
    updatedAt: now,
  }

  await upsertWaveformState({
    mediaAssetId,
    insert: { ...updateFields, requestedAt: now, createdAt: now },
    update: updateFields,
  })
}

export const saveWaveformResult = async ({
  mediaAssetId,
  peaks,
  bucketCount,
}: {
  mediaAssetId: string
  peaks: number[]
  bucketCount: number
}) => {
  const now = new Date()
  const updateFields = {
    status: "ready" as const,
    peaks,
    bucketCount,
    lastError: null,
    completedAt: now,
    updatedAt: now,
  }

  await upsertWaveformState({
    mediaAssetId,
    insert: { ...updateFields, requestedAt: now, startedAt: now, createdAt: now },
    update: updateFields,
  })
}

export const failWaveform = async ({
  mediaAssetId,
  error,
}: {
  mediaAssetId: string
  error: string
}) => {
  const now = new Date()
  const updateFields = {
    status: "failed" as const,
    peaks: null,
    bucketCount: null,
    lastError: error,
    completedAt: now,
    updatedAt: now,
  }

  await upsertWaveformState({
    mediaAssetId,
    insert: { ...updateFields, requestedAt: now, startedAt: now, createdAt: now },
    update: updateFields,
  })
}

export const applyWaveformStateUpdate = async (
  update: WaveformStateUpdate
) => {
  switch (update.event) {
    case "processing":
      await markWaveformProcessing(update.mediaAssetId)
      return

    case "ready":
      await saveWaveformResult({
        mediaAssetId: update.mediaAssetId,
        peaks: update.peaks,
        bucketCount: update.bucketCount,
      })
      return

    case "failed":
      await failWaveform({
        mediaAssetId: update.mediaAssetId,
        error: update.error,
      })
      return
  }
}

export const ensureWaveformRequested = async ({
  mediaAssetId,
  sourceUrl,
  waveform,
}: {
  mediaAssetId: string
  sourceUrl?: string
  waveform?: MediaWaveform
}) => {
  if (
    waveform?.status === "ready" ||
    waveform?.status === "processing" ||
    waveform?.status === "failed"
  ) {
    return waveform
  }

  if (!sourceUrl) {
    return waveform
  }

  if (waveform?.status === "pending" && !waveform.lastError) {
    return waveform
  }

  await markWaveformPending(mediaAssetId)

  try {
    await enqueueWaveformJob({
      jobType: "generate_waveform",
      mediaAssetId,
      sourceUrl,
      bucketCount: DEFAULT_WAVEFORM_BUCKET_COUNT,
    })

    return toMediaWaveform({
      status: "pending",
    })
  } catch (error) {
    const errorMessage = getErrorMessage(
      error,
      "Unable to enqueue waveform generation."
    )

    await saveWaveformEnqueueError({
      mediaAssetId,
      error: errorMessage,
    })

    return toMediaWaveform({
      status: "pending",
      lastError: errorMessage,
    })
  }
}
