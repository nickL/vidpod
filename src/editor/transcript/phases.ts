export const TRANSCRIPT_JOB_PHASES = [
  "extracting",
  "transcribing",
  "building",
] as const

export type TranscriptJobPhase = (typeof TRANSCRIPT_JOB_PHASES)[number]

export const isTranscriptJobPhase = (
  value: unknown
): value is TranscriptJobPhase => {
  return TRANSCRIPT_JOB_PHASES.includes(value as TranscriptJobPhase)
}

export const getTranscriptJobProgressMessage = ({
  completedChunks,
  phase,
  totalChunks,
}: {
  phase: TranscriptJobPhase
  completedChunks?: number
  totalChunks?: number
}) => {
  switch (phase) {
    case "extracting":
      return "Getting the transcript ready…"
    case "transcribing":
      if (
        typeof completedChunks === "number" &&
        typeof totalChunks === "number" &&
        totalChunks > 0
      ) {
        return `Transcribing audio (${completedChunks} of ${totalChunks})…`
      }

      return "Transcribing audio…"
    case "building":
      return "Building the transcript…"
  }
}

export const getTranscriptPhaseLabel = (phase?: TranscriptJobPhase) => {
  switch (phase) {
    case "transcribing":
      return "Transcribing audio"
    case "building":
      return "Almost ready…"
    case "extracting":
    default:
      return "Getting the transcript ready…"
  }
}
