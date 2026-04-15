"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { secondsToMs } from "../time"

import type { MediaTranscript, TranscriptJob, TranscriptJobStatus } from "../types"
import type {
  Transcript,
  TranscriptSegment,
  TranscriptStatus,
  TranscriptWord,
} from "./types"

type UseTranscriptOptions = {
  mainMediaAssetId?: string
  initialJob?: TranscriptJob
}

const JOB_POLL_MS = 3_000
const SEGMENT_GAP_MS = 1_200
const MAX_SEGMENT_WORDS = 16

const toTranscriptStatus = (status?: TranscriptJobStatus): TranscriptStatus => {
  if (!status) return "pending"
  if (status === "queued") return "processing"
  return status
}

const buildSegments = (record: MediaTranscript): TranscriptSegment[] => {
  const segments: TranscriptSegment[] = []
  let currentWords: TranscriptWord[] = []

  const commitSegment = () => {
    if (currentWords.length === 0) return

    const firstWord = currentWords[0]
    const finalWord = currentWords[currentWords.length - 1]
    segments.push({
      id: `segment-${segments.length + 1}`,
      startMs: firstWord.startMs,
      endMs: finalWord.endMs,
      words: currentWords,
    })
    currentWords = []
  }

  for (const word of record.words) {
    const nextWord = {
      startMs: secondsToMs(word.start),
      endMs: secondsToMs(word.end),
      text: word.word,
    }
    const lastWord = currentWords[currentWords.length - 1]
    const shouldSplit =
      currentWords.length >= MAX_SEGMENT_WORDS ||
      (lastWord ? nextWord.startMs - lastWord.endMs > SEGMENT_GAP_MS : false)

    if (shouldSplit) {
      commitSegment()
    }

    currentWords.push(nextWord)
  }

  commitSegment()

  return segments
}

export const useTranscript = ({
  mainMediaAssetId,
  initialJob,
}: UseTranscriptOptions) => {
  const matchingInitialJob =
    initialJob?.mediaAssetId === mainMediaAssetId ? initialJob : undefined
  const jobId = matchingInitialJob?.id
  const jobQuery = useQuery<TranscriptJob>({
    queryKey: ["transcript-job", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/transcript-jobs/${jobId}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Couldn't load the transcript job.")
      }

      return response.json()
    },
    enabled: !!jobId,
    initialData: matchingInitialJob,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "queued" || status === "processing" ? JOB_POLL_MS : false
    },
  })

  const job = jobQuery.data
  const transcriptReady = job?.status === "ready" && !!mainMediaAssetId

  const recordQuery = useQuery<MediaTranscript>({
    queryKey: ["media-transcript", mainMediaAssetId],
    queryFn: async () => {
      const response = await fetch(
        `/api/media-assets/${mainMediaAssetId}/transcript`,
        { cache: "no-store" }
      )

      if (!response.ok) {
        throw new Error("Couldn't load the transcript.")
      }

      return response.json()
    },
    enabled: transcriptReady,
  })

  const record = recordQuery.data
  const segments = useMemo(
    () => (record ? buildSegments(record) : undefined),
    [record]
  )

  const transcript = useMemo<Transcript>(
    () => ({
      status: toTranscriptStatus(job?.status),
      phase: job?.phase,
      completedChunks: job?.completedChunks,
      totalChunks: job?.totalChunks,
      segments,
    }),
    [job, segments]
  )

  return { transcript }
}
