export type TranscriptJobMessage = {
  jobType: "generate_transcript"
  jobId: string
}

export type TranscriptChunkMessage = {
  jobType: "transcribe_transcript_chunk"
  audioUrl: string
  attemptId: string
  chunkIndex: number
  durationMs: number
  jobId: string
  startMs: number
}

export type TranscriptMessage = TranscriptJobMessage | TranscriptChunkMessage

const asObject = (value: unknown) =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null

export const isTranscriptJobMessage = (
  value: unknown
): value is TranscriptJobMessage => {
  const message = asObject(value)

  return (
    !!message &&
    message.jobType === "generate_transcript" &&
    typeof message.jobId === "string"
  )
}

export const isTranscriptChunkMessage = (
  value: unknown
): value is TranscriptChunkMessage => {
  const message = asObject(value)

  return (
    !!message &&
    message.jobType === "transcribe_transcript_chunk" &&
    typeof message.audioUrl === "string" &&
    typeof message.attemptId === "string" &&
    typeof message.chunkIndex === "number" &&
    typeof message.durationMs === "number" &&
    typeof message.jobId === "string" &&
    typeof message.startMs === "number"
  )
}

export const buildChunkMessages = ({
  audioUrl,
  attemptId,
  chunkDurationMs,
  chunkOverlapMs,
  durationMs,
  jobId,
  totalChunks,
}: {
  audioUrl: string
  attemptId: string
  chunkDurationMs: number
  chunkOverlapMs: number
  durationMs: number
  jobId: string
  totalChunks: number
}): TranscriptChunkMessage[] => {
  const chunkStepMs = chunkDurationMs - chunkOverlapMs
  const messages: TranscriptChunkMessage[] = []

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const startMs = chunkIndex * chunkStepMs
    const durationForChunkMs = Math.min(chunkDurationMs, durationMs - startMs)

    if (durationForChunkMs <= 0) {
      continue
    }

    messages.push({
      jobType: "transcribe_transcript_chunk",
      audioUrl,
      attemptId,
      chunkIndex,
      durationMs: durationForChunkMs,
      jobId,
      startMs,
    })
  }

  return messages
}
