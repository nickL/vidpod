import "server-only"

import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import { mp4ExportJobs } from "@/db/schema"
import { createR2DownloadUrl, createR2UploadUrl } from "@/lib/r2"
import { serverEnv } from "@/env/server"

import { getMp4Plan } from "./playback/playback-sessions"
import {
  getMp4ExportJobPhaseMessage,
  isMp4ExportJobPhase,
  type Mp4ExportJobPhase,
} from "./mp4-export/phases"

import type {
  Mp4ExportArtifact,
  Mp4ExportJob,
  Mp4Plan,
} from "./types"

// Note: bump this to force a re-encode when the export format changes (baked into the R2 key).
const MP4_EXPORT_VERSION = "v5"
const MP4_CONTENT_TYPE = "video/mp4"

type GenerateMp4ExportJob = {
  jobType: "generate_mp4_export"
  jobId: string
}

type ProcessingMp4ExportJobUpdate = {
  event: "processing"
  jobId: string
  phase: "preparing"
}

type ProgressMp4ExportJobUpdate = {
  event: "progress"
  jobId: string
  phase: Mp4ExportJobPhase
}

type ReadyMp4ExportJobUpdate = {
  event: "ready"
  jobId: string
  output: Mp4ExportArtifact
  progressMessage?: string
}

type FailedMp4ExportJobUpdate = {
  event: "failed"
  jobId: string
  error: string
  progressMessage?: string
}

export type Mp4ExportJobStateUpdate =
  | ProcessingMp4ExportJobUpdate
  | ProgressMp4ExportJobUpdate
  | ReadyMp4ExportJobUpdate
  | FailedMp4ExportJobUpdate

export type Mp4ExportJobInput = {
  plan: Mp4Plan
  artifact: Mp4ExportArtifact & {
    uploadUrl: string
  }
}

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  return error instanceof Error && error.message
    ? error.message
    : fallbackMessage
}

const slugify = (value: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "episode"
}

const buildMp4FileName = (plan: Mp4Plan) => {
  return `${slugify(plan.episode.title)}-${plan.playbackSessionId.slice(0, 8)}-${MP4_EXPORT_VERSION}.mp4`
}

const buildMp4Artifact = (jobId: string, plan: Mp4Plan): Mp4ExportArtifact => {
  const fileName = buildMp4FileName(plan)

  return {
    storage: "r2",
    key: `mp4-exports/${jobId}/${fileName}`,
    fileName,
    contentType: MP4_CONTENT_TYPE,
  }
}

const readPhase = (
  value: typeof mp4ExportJobs.$inferSelect.phase
): Mp4ExportJobPhase | undefined => {
  if (!value) {
    return undefined
  }

  return isMp4ExportJobPhase(value) ? value : undefined
}

// Note: we only check the discriminator here — legacy rows (old Fly downloadUrl shape) lack storage="r2" and get rejected. Any row we've written ourselves has the right fields.
const readArtifact = (
  value: typeof mp4ExportJobs.$inferSelect.outputJson
): Mp4ExportArtifact | undefined => {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const output = value as Record<string, unknown>

  if (output.storage !== "r2") {
    return undefined
  }

  return output as unknown as Mp4ExportArtifact
}

const toJob = (row: typeof mp4ExportJobs.$inferSelect): Mp4ExportJob => {
  return {
    id: row.id,
    playbackSessionId: row.playbackSessionId,
    status: row.status,
    phase: readPhase(row.phase),
    progressMessage: row.progressMessage ?? undefined,
    error: row.error ?? undefined,
    output: readArtifact(row.outputJson),
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const enqueueMp4Export = async (job: GenerateMp4ExportJob) => {
  const workerBaseUrl = serverEnv.cloudflareWorkerPublicBaseUrl
  const mediaJobsToken = serverEnv.mediaJobsToken

  if (!workerBaseUrl || !mediaJobsToken) {
    throw new Error("Cloudflare media jobs worker is not configured")
  }

  const response = await fetch(
    `${workerBaseUrl.replace(/\/$/, "")}/enqueue-mp4-export`,
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
    throw new Error(payload?.error || "Unable to enqueue MP4 export job")
  }
}

const loadJobRow = async (jobId: string) => {
  const [job] = await db
    .select()
    .from(mp4ExportJobs)
    .where(eq(mp4ExportJobs.id, jobId))
    .limit(1)

  return job
}

const loadJobForSession = async (playbackSessionId: string) => {
  const [job] = await db
    .select()
    .from(mp4ExportJobs)
    .where(eq(mp4ExportJobs.playbackSessionId, playbackSessionId))
    .limit(1)

  return job ? toJob(job) : undefined
}

export const getMp4ExportJob = async (jobId: string) => {
  const job = await loadJobRow(jobId)
  return job ? toJob(job) : undefined
}

export const getMp4ExportJobInput = async (
  jobId: string
): Promise<Mp4ExportJobInput | undefined> => {
  const job = await loadJobRow(jobId)

  if (!job) {
    return undefined
  }

  const plan = await getMp4Plan(job.playbackSessionId)
  const artifact = buildMp4Artifact(jobId, plan)
  const uploadUrl = await createR2UploadUrl({
    key: artifact.key,
    contentType: artifact.contentType,
  })

  return {
    plan,
    artifact: {
      ...artifact,
      uploadUrl,
    },
  }
}

export const getMp4ExportDownloadUrl = async (jobId: string) => {
  const job = await loadJobRow(jobId)
  const output = job ? readArtifact(job.outputJson) : undefined

  if (!output) {
    return undefined
  }

  return createR2DownloadUrl({
    key: output.key,
    fileName: output.fileName,
    contentType: output.contentType,
  })
}

export const startMp4ExportJob = async (playbackSessionId: string) => {
  const currentJob = await loadJobForSession(playbackSessionId)

  if (currentJob && currentJob.status !== "failed") {
    return currentJob
  }

  const now = new Date()
  let jobId: string

  if (currentJob?.status === "failed") {
    const resetResult = await db
      .update(mp4ExportJobs)
      .set({
        status: "queued",
        phase: null,
        outputJson: null,
        progressMessage: "Waiting to start…",
        error: null,
        startedAt: null,
        completedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(mp4ExportJobs.id, currentJob.id),
          eq(mp4ExportJobs.status, "failed")
        )
      )
      .returning({ id: mp4ExportJobs.id })

    if (resetResult.length === 0) {
      const job = await loadJobForSession(playbackSessionId)

      if (!job) {
        throw new Error("Couldn't retry the MP4 export.")
      }

      return job
    }

    jobId = currentJob.id
  } else {
    jobId = crypto.randomUUID()

    const insertResult = await db
      .insert(mp4ExportJobs)
      .values({
        id: jobId,
        playbackSessionId,
        status: "queued",
        phase: null,
        progressMessage: "Waiting to start…",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: mp4ExportJobs.playbackSessionId,
      })
      .returning({ id: mp4ExportJobs.id })

    if (insertResult.length === 0) {
      const job = await loadJobForSession(playbackSessionId)

      if (!job) {
        throw new Error("Couldn't start the MP4 export.")
      }

      return job
    }
  }

  try {
    await enqueueMp4Export({
      jobType: "generate_mp4_export",
      jobId,
    })
  } catch (error) {
    const errorMessage = getErrorMessage(
      error,
      "Couldn't start the MP4 export."
    )
    const failedAt = new Date()

    await db
      .update(mp4ExportJobs)
      .set({
        status: "failed",
        phase: null,
        error: errorMessage,
        progressMessage: "Couldn't start the MP4 export.",
        completedAt: failedAt,
        updatedAt: failedAt,
      })
      .where(eq(mp4ExportJobs.id, jobId))
  }

  const job = await getMp4ExportJob(jobId)

  if (!job) {
    throw new Error("Couldn't start the MP4 export.")
  }

  return job
}

export const applyMp4ExportJobStateUpdate = async (
  update: Mp4ExportJobStateUpdate
) => {
  const now = new Date()

  switch (update.event) {
    case "processing": {
      const claimResult = await db
        .update(mp4ExportJobs)
        .set({
          status: "processing",
          phase: update.phase,
          progressMessage: getMp4ExportJobPhaseMessage(update.phase),
          error: null,
          startedAt: now,
          completedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(mp4ExportJobs.id, update.jobId),
            eq(mp4ExportJobs.status, "queued")
          )
        )
        .returning({ id: mp4ExportJobs.id })

      if (claimResult.length > 0) {
        return { ok: true, claimed: true, currentStatus: "processing" as const }
      }

      const [job] = await db
        .select({ status: mp4ExportJobs.status })
        .from(mp4ExportJobs)
        .where(eq(mp4ExportJobs.id, update.jobId))
        .limit(1)

      return { ok: true, claimed: false, currentStatus: job?.status }
    }

    case "progress":
      await db
        .update(mp4ExportJobs)
        .set({
          phase: update.phase,
          progressMessage: getMp4ExportJobPhaseMessage(update.phase),
          updatedAt: now,
        })
        .where(
          and(
            eq(mp4ExportJobs.id, update.jobId),
            eq(mp4ExportJobs.status, "processing")
          )
        )
      return { ok: true }

    case "ready":
      await db
        .update(mp4ExportJobs)
        .set({
          status: "ready",
          phase: null,
          outputJson: update.output,
          progressMessage:
            update.progressMessage ?? "Your MP4 is ready to download.",
          error: null,
          completedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(mp4ExportJobs.id, update.jobId),
            inArray(mp4ExportJobs.status, ["queued", "processing"])
          )
        )
      return { ok: true }

    case "failed":
      await db
        .update(mp4ExportJobs)
        .set({
          status: "failed",
          phase: null,
          error: update.error,
          progressMessage: update.progressMessage ?? "Something went wrong.",
          completedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(mp4ExportJobs.id, update.jobId),
            inArray(mp4ExportJobs.status, ["queued", "processing"])
          )
        )
      return { ok: true }
  }
}
