import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/db"
import { mediaTranscripts } from "@/db/schema"
import { readR2Json } from "@/lib/r2"

import type {
  MediaTranscript,
  TranscriptArtifact,
  TranscriptWord,
} from "../types"

const toTranscript = async (
  row: typeof mediaTranscripts.$inferSelect
): Promise<MediaTranscript> => {
  const wordsArtifact = row.wordsArtifactJson as TranscriptArtifact
  const words = await readR2Json<TranscriptWord[]>(wordsArtifact.key)

  return {
    id: row.id,
    mediaAssetId: row.mediaAssetId,
    jobId: row.jobId,
    text: row.text,
    words,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const getMediaTranscript = async (mediaAssetId: string) => {
  const [row] = await db
    .select()
    .from(mediaTranscripts)
    .where(eq(mediaTranscripts.mediaAssetId, mediaAssetId))
    .limit(1)

  if (!row) {
    return undefined
  }

  return toTranscript(row)
}

export const upsertMediaTranscript = async ({
  jobId,
  mediaAssetId,
  text,
  wordsArtifact,
}: {
  mediaAssetId: string
  jobId: string
  text: string
  wordsArtifact: TranscriptArtifact
}) => {
  const now = new Date()

  await db
    .insert(mediaTranscripts)
    .values({
      mediaAssetId,
      jobId,
      text,
      wordsArtifactJson: wordsArtifact,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: mediaTranscripts.mediaAssetId,
      set: {
        jobId,
        text,
        wordsArtifactJson: wordsArtifact,
        updatedAt: now,
      },
    })
}
