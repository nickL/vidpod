import "server-only"

import { createR2UploadUrl } from "@/lib/r2"

import { loadJobRow, loadReadyMediaAsset } from "./transcript-jobs"

import type { TranscriptArtifact } from "../types"

const TRANSCRIPT_CHUNK_DURATION_MS = 30_000
const TRANSCRIPT_CHUNK_OVERLAP_MS = 2_000
const TRANSCRIPT_ARTIFACT_URL_TTL_SECONDS = 60 * 60 * 6

export type TranscriptJobInput = {
  mediaAssetId: string
  streamVideoId: string
  durationMs: number
  chunkDurationMs: number
  chunkOverlapMs: number
  totalChunks: number
  wordsArtifact: TranscriptArtifact & {
    uploadUrl: string
  }
}

const buildWordsArtifact = (jobId: string, mediaAssetId: string) => {
  const baseName = `transcript-${mediaAssetId.slice(0, 8)}`

  return {
    storage: "r2" as const,
    key: `transcripts/${jobId}/${baseName}.words.json`,
    fileName: `${baseName}.words.json`,
    contentType: "application/json" as const,
  }
}

const calculateTotalChunks = ({
  chunkDurationMs,
  chunkOverlapMs,
  durationMs,
}: {
  durationMs: number
  chunkDurationMs: number
  chunkOverlapMs: number
}) => {
  if (durationMs <= chunkDurationMs) {
    return 1
  }

  const chunkStepMs = chunkDurationMs - chunkOverlapMs
  return Math.max(1, Math.ceil((durationMs - chunkOverlapMs) / chunkStepMs))
}

export const getTranscriptJobInput = async (
  jobId: string
): Promise<TranscriptJobInput | undefined> => {
  const job = await loadJobRow(jobId)

  if (!job) {
    return undefined
  }

  const mediaAsset = await loadReadyMediaAsset(job.mediaAssetId)

  if (!mediaAsset) {
    return undefined
  }

  const totalChunks = calculateTotalChunks({
    durationMs: mediaAsset.durationMs,
    chunkDurationMs: TRANSCRIPT_CHUNK_DURATION_MS,
    chunkOverlapMs: TRANSCRIPT_CHUNK_OVERLAP_MS,
  })
  const wordsArtifact = buildWordsArtifact(jobId, mediaAsset.id)
  const uploadUrl = await createR2UploadUrl({
    key: wordsArtifact.key,
    contentType: wordsArtifact.contentType,
    expiresIn: TRANSCRIPT_ARTIFACT_URL_TTL_SECONDS,
  })

  return {
    mediaAssetId: mediaAsset.id,
    streamVideoId: mediaAsset.streamVideoId,
    durationMs: mediaAsset.durationMs,
    chunkDurationMs: TRANSCRIPT_CHUNK_DURATION_MS,
    chunkOverlapMs: TRANSCRIPT_CHUNK_OVERLAP_MS,
    totalChunks,
    wordsArtifact: {
      ...wordsArtifact,
      uploadUrl,
    },
  }
}
