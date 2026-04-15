import type { TranscriptJobPhase } from "./phases"

export type TranscriptStatus = "pending" | "processing" | "ready" | "failed"

export type TranscriptWord = {
  startMs: number
  endMs: number
  text: string
}

export type TranscriptSegment = {
  id: string
  startMs: number
  endMs: number
  words: TranscriptWord[]
}

export type Transcript = {
  status: TranscriptStatus
  phase?: TranscriptJobPhase
  completedChunks?: number
  totalChunks?: number
  segments?: TranscriptSegment[]
}

export type TranscriptSlot = {
  isOpen: boolean
  onToggle: () => void
}
