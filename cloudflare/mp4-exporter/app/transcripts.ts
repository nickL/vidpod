import { readFile, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { runFfmpeg } from "./ffmpeg.js"
import {
  readNonNegativeInt,
  readPositiveInt,
  readUrl,
} from "./input.js"

const TRANSCRIPT_DIR = path.join(tmpdir(), "vidpod-transcript-exporter")

type TranscriptChunkInput = {
  audioUrl: unknown
  durationMs: unknown
  startMs: unknown
}

export type TranscriptChunkAudio = {
  body: Buffer
  contentType: "audio/mpeg"
}

const readTranscriptChunkInput = (
  value: TranscriptChunkInput
) => {
  return {
    audioUrl: readUrl(value.audioUrl, "audioUrl is required"),
    startMs: readNonNegativeInt(value.startMs, "startMs is required"),
    durationMs: readPositiveInt(value.durationMs, "durationMs is required"),
  }
}

const toSeconds = (timeMs: number) => {
  return (timeMs / 1000).toFixed(3)
}

const buildTranscriptChunkArgs = ({
  audioUrl,
  durationMs,
  outputPath,
  startMs,
}: {
  audioUrl: string
  durationMs: number
  outputPath: string
  startMs: number
}) => [
  "-y",
  "-ss", toSeconds(startMs),
  "-t", toSeconds(durationMs),
  "-i", audioUrl,
  "-vn",
  "-ac", "1",
  "-ar", "16000",
  "-c:a", "libmp3lame",
  "-b:a", "64k",
  outputPath,
]

export const extractTranscriptChunkAudio = async (
  input: TranscriptChunkInput
): Promise<TranscriptChunkAudio> => {
  const chunk = readTranscriptChunkInput(input)
  const tempFilePath = path.join(
    TRANSCRIPT_DIR,
    `transcript.${chunk.startMs}.${chunk.durationMs}.${process.pid}.${Date.now()}.mp3`
  )

  await mkdir(TRANSCRIPT_DIR, { recursive: true })

  try {
    await runFfmpeg(
      buildTranscriptChunkArgs({
        audioUrl: chunk.audioUrl,
        durationMs: chunk.durationMs,
        outputPath: tempFilePath,
        startMs: chunk.startMs,
      })
    )

    return {
      body: await readFile(tempFilePath),
      contentType: "audio/mpeg",
    }
  } finally {
    await rm(tempFilePath, { force: true }).catch(() => undefined)
  }
}
