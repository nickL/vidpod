import "server-only"

import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import { mediaAssets, transcriptionJobs } from "@/db/schema"
import { serverEnv } from "@/env/server"

import { upsertMediaTranscript } from "./transcript-records"
import {
  getTranscriptJobProgressMessage,
  isTranscriptJobPhase,
  type TranscriptJobPhase,
} from "./phases"

import type { TranscriptArtifact, TranscriptJob } from "../types"

const TRANSCRIPT_START_MESSAGE = "Waiting to start…"

type ProcessingTranscriptJobUpdate = {
  event: "processing"
  jobId: string
  phase: "extracting"
  totalChunks: number
}

type ProgressTranscriptJobUpdate = {
  event: "progress"
  jobId: string
  phase: TranscriptJobPhase
  totalChunks?: number
  completedChunks?: number
}

type ReadyTranscriptJobUpdate = {
  event: "ready"
  jobId: string
  text: string
  wordsArtifact: TranscriptArtifact
}

type FailedTranscriptJobUpdate = {
  event: "failed"
  jobId: string
  error: string
}

export type TranscriptJobStateUpdate =
  | ProcessingTranscriptJobUpdate
  | ProgressTranscriptJobUpdate
  | ReadyTranscriptJobUpdate
  | FailedTranscriptJobUpdate

const readPhase = (
  value: typeof transcriptionJobs.$inferSelect.phase
): TranscriptJobPhase | undefined => {
  if (!value) {
    return undefined
  }

  return isTranscriptJobPhase(value) ? value : undefined
}

const toJob = (row: typeof transcriptionJobs.$inferSelect): TranscriptJob => {
  return {
    id: row.id,
    mediaAssetId: row.mediaAssetId,
    status: row.status,
    phase: readPhase(row.phase),
    progressMessage: row.progressMessage ?? undefined,
    error: row.error ?? undefined,
    totalChunks: row.totalChunks ?? undefined,
    completedChunks: row.completedChunks ?? undefined,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const enqueueTranscriptJob = async (jobId: string) => {
  const workerBaseUrl = serverEnv.cloudflareWorkerPublicBaseUrl
  const mediaJobsToken = serverEnv.mediaJobsToken

  if (!workerBaseUrl || !mediaJobsToken) {
    throw new Error("Cloudflare media jobs worker is not configured")
  }

  const response = await fetch(
    `${workerBaseUrl.replace(/\/$/, "")}/enqueue-transcript`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${mediaJobsToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ jobType: "generate_transcript", jobId }),
      cache: "no-store",
    }
  )
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null

  if (!response.ok) {
    throw new Error(payload?.error || "Couldn't start the transcript.")
  }
}

export const loadJobRow = async (jobId: string) => {
  const [job] = await db
    .select()
    .from(transcriptionJobs)
    .where(eq(transcriptionJobs.id, jobId))
    .limit(1)

  return job
}

export const getTranscriptJobForMediaAsset = async (mediaAssetId: string) => {
  const [job] = await db
    .select()
    .from(transcriptionJobs)
    .where(eq(transcriptionJobs.mediaAssetId, mediaAssetId))
    .limit(1)

  return job ? toJob(job) : undefined
}

export const loadReadyMediaAsset = async (mediaAssetId: string) => {
  const [mediaAsset] = await db
    .select({
      id: mediaAssets.id,
      durationMs: mediaAssets.durationMs,
      streamVideoId: mediaAssets.streamVideoId,
      status: mediaAssets.status,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaAssetId))
    .limit(1)

  if (!mediaAsset || mediaAsset.status !== "ready") {
    return undefined
  }

  const { durationMs, streamVideoId } = mediaAsset

  if (!durationMs) {
    return undefined
  }

  return {
    ...mediaAsset,
    durationMs,
    streamVideoId,
  }
}

export const getTranscriptJob = async (jobId: string) => {
  const job = await loadJobRow(jobId)
  return job ? toJob(job) : undefined
}

export const startTranscriptJob = async (mediaAssetId: string) => {
  const mediaAsset = await loadReadyMediaAsset(mediaAssetId)

  if (!mediaAsset) {
    throw new Error("This video isn't ready for transcription yet.")
  }

  const existing = await getTranscriptJobForMediaAsset(mediaAssetId)

  if (existing?.status === "queued") {
    await enqueueTranscriptJob(existing.id)
    return existing
  }

  if (existing && existing.status !== "failed") {
    return existing
  }

  const now = new Date()
  const [row] = await db
    .insert(transcriptionJobs)
    .values({
      mediaAssetId,
      status: "queued",
      progressMessage: TRANSCRIPT_START_MESSAGE,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: transcriptionJobs.mediaAssetId,
      set: {
        status: "queued",
        phase: null,
        progressMessage: TRANSCRIPT_START_MESSAGE,
        error: null,
        totalChunks: null,
        completedChunks: null,
        startedAt: null,
        completedAt: null,
        updatedAt: now,
      },
      setWhere: eq(transcriptionJobs.status, "failed"),
    })
    .returning()

  if (!row) {
    const job = await getTranscriptJobForMediaAsset(mediaAssetId)

    if (!job) {
      throw new Error("Couldn't start the transcript.")
    }

    if (job.status === "queued") {
      await enqueueTranscriptJob(job.id)
    }

    return job
  }

  await enqueueTranscriptJob(row.id)

  return toJob(row)
}

export const updateTranscriptJobState = async (
  update: TranscriptJobStateUpdate
) => {
  const now = new Date()

  switch (update.event) {
    case "processing": {
      const claimResult = await db
        .update(transcriptionJobs)
        .set({
          status: "processing",
          phase: update.phase,
          progressMessage: getTranscriptJobProgressMessage({
            phase: update.phase,
            totalChunks: update.totalChunks,
            completedChunks: 0,
          }),
          totalChunks: update.totalChunks,
          completedChunks: 0,
          error: null,
          startedAt: now,
          completedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(transcriptionJobs.id, update.jobId),
            eq(transcriptionJobs.status, "queued")
          )
        )
        .returning({ id: transcriptionJobs.id })

      if (claimResult.length > 0) {
        return { ok: true, claimed: true, currentStatus: "processing" as const }
      }

      const [job] = await db
        .select({ status: transcriptionJobs.status })
        .from(transcriptionJobs)
        .where(eq(transcriptionJobs.id, update.jobId))
        .limit(1)

      return { ok: true, claimed: false, currentStatus: job?.status }
    }

    case "progress":
      await db
        .update(transcriptionJobs)
        .set({
          phase: update.phase,
          progressMessage: getTranscriptJobProgressMessage({
            phase: update.phase,
            totalChunks: update.totalChunks,
            completedChunks: update.completedChunks,
          }),
          totalChunks: update.totalChunks ?? undefined,
          completedChunks: update.completedChunks ?? undefined,
          updatedAt: now,
        })
        .where(
          and(
            eq(transcriptionJobs.id, update.jobId),
            eq(transcriptionJobs.status, "processing")
          )
        )
      return { ok: true }

    case "ready": {
      const job = await loadJobRow(update.jobId)

      if (
        !job ||
        !["queued", "processing"].includes(job.status)
      ) {
        return { ok: true }
      }

      await upsertMediaTranscript({
        mediaAssetId: job.mediaAssetId,
        jobId: job.id,
        text: update.text,
        wordsArtifact: update.wordsArtifact,
      })

      await db
        .update(transcriptionJobs)
        .set({
          status: "ready",
          phase: null,
          progressMessage: "Transcript is ready.",
          error: null,
          completedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(transcriptionJobs.id, update.jobId),
            inArray(transcriptionJobs.status, ["queued", "processing"])
          )
        )

      return { ok: true }
    }

    case "failed":
      await db
        .update(transcriptionJobs)
        .set({
          status: "failed",
          phase: null,
          error: update.error,
          progressMessage: "Something went wrong.",
          completedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(transcriptionJobs.id, update.jobId),
            inArray(transcriptionJobs.status, ["queued", "processing"])
          )
        )
      return { ok: true }
  }
}
