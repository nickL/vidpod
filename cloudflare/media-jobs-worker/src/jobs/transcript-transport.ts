import { trimTrailingSlash, type AppJobEnv } from "./shared"
import type {
  TranscriptChunkMessage,
  TranscriptMessage,
} from "./transcript-messages"

const TRANSCRIPT_MODEL = "@cf/openai/whisper-tiny-en"
const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
const STREAM_AUDIO_POLL_MS = 2_000
const STREAM_AUDIO_TIMEOUT_MS = 300_000

type QueueBinding<T> = {
  send(message: T): Promise<void>
}

export type TranscriptEnv = AppJobEnv & {
  AI: Ai
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_STREAM_API_TOKEN: string
  MEDIA_JOBS: QueueBinding<TranscriptMessage>
  TRANSCRIPT_JOB: DurableObjectNamespace
}

export type TranscriptArtifact = {
  storage: "r2"
  key: string
  fileName: string
  contentType: "application/json"
}

export type TranscriptJobInput = {
  mediaAssetId: string
  streamVideoId: string
  durationMs: number
  chunkDurationMs: number
  chunkOverlapMs: number
  totalChunks: number
  wordsArtifact: TranscriptArtifact & { uploadUrl: string }
}

export type TranscriptJobUpdateResult = {
  error?: string
  claimed?: boolean
  currentStatus?: "queued" | "processing" | "ready" | "failed"
}

export type ChunkTranscript = {
  text: string
  words?: Array<{
    word?: string
    start?: number
    end?: number
  }>
}

type StreamDownload = {
  status?: "ready" | "inprogress" | "error"
  url?: string
}

type StreamDownloadsResponse = {
  errors?: Array<{ message?: string }>
  result?: {
    audio?: StreamDownload
  }
  success?: boolean
}

const getStreamHeaders = (env: TranscriptEnv) => {
  return {
    authorization: `Bearer ${env.CLOUDFLARE_STREAM_API_TOKEN}`,
  }
}

const getStreamError = (
  payload: StreamDownloadsResponse | null,
  fallback: string
) => {
  return payload?.errors?.find((error) => error.message)?.message || fallback
}

const loadStreamAudioDownload = async (
  env: TranscriptEnv,
  streamVideoId: string
) => {
  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/${streamVideoId}/downloads`,
    {
      headers: getStreamHeaders(env),
    }
  )
  const payload = (await response.json().catch(() => null)) as
    | StreamDownloadsResponse
    | null

  if (response.status === 404) {
    return undefined
  }

  if (!response.ok || payload?.success === false) {
    throw new Error(getStreamError(payload, "Couldn't load Stream audio."))
  }

  return payload?.result?.audio
}

const createStreamAudioDownload = async (
  env: TranscriptEnv,
  streamVideoId: string
) => {
  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/${streamVideoId}/downloads/audio`,
    {
      method: "POST",
      headers: getStreamHeaders(env),
    }
  )
  const payload = (await response.json().catch(() => null)) as
    | StreamDownloadsResponse
    | null

  if (!response.ok || payload?.success === false) {
    throw new Error(getStreamError(payload, "Couldn't create Stream audio."))
  }

  return payload?.result?.audio
}

export const loadTranscriptAudioUrl = async (
  env: TranscriptEnv,
  streamVideoId: string
) => {
  const current = await loadStreamAudioDownload(env, streamVideoId)

  if (current?.status === "ready" && current.url) {
    return current.url
  }

  const audio =
    current?.status === "inprogress"
      ? current
      : await createStreamAudioDownload(env, streamVideoId)

  if (audio?.status === "ready" && audio.url) {
    return audio.url
  }

  const deadline = Date.now() + STREAM_AUDIO_TIMEOUT_MS

  while (Date.now() < deadline) {
    await scheduler.wait(STREAM_AUDIO_POLL_MS)

    const next = await loadStreamAudioDownload(env, streamVideoId)

    if (next?.status === "ready" && next.url) {
      return next.url
    }

    if (next?.status === "error") {
      throw new Error("Couldn't build Stream audio.")
    }
  }

  throw new Error("Stream audio is still preparing.")
}

export const updateTranscriptJob = async (
  env: TranscriptEnv,
  body: unknown
) => {
  const response = await fetch(
    `${trimTrailingSlash(env.APP_INTERNAL_BASE_URL)}/api/worker/transcript-jobs`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.MEDIA_JOBS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }
  )

  const payload = (await response.json().catch(() => null)) as
    | TranscriptJobUpdateResult
    | null

  if (!response.ok) {
    throw new Error(payload?.error || "Couldn't update the transcript job.")
  }

  return payload
}

export const loadTranscriptJobInput = async (
  env: TranscriptEnv,
  jobId: string
): Promise<TranscriptJobInput> => {
  const response = await fetch(
    `${trimTrailingSlash(env.APP_INTERNAL_BASE_URL)}/api/worker/transcript-jobs/${jobId}/input`,
    {
      headers: {
        authorization: `Bearer ${env.MEDIA_JOBS_TOKEN}`,
      },
    }
  )
  const payload = (await response.json().catch(() => null)) as
    | TranscriptJobInput
    | { error?: string }
    | null

  if (!response.ok || !payload || !("streamVideoId" in payload)) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : "Couldn't load transcript input."
    )
  }

  return payload
}

export const requestTranscriptChunkAudio = async (
  env: TranscriptEnv,
  chunk: TranscriptChunkMessage
) => {
  const response = await fetch(
    `${trimTrailingSlash(env.TRANSCODER_URL)}/transcripts/chunk`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.TRANSCODER_AUTH_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        audioUrl: chunk.audioUrl,
        startMs: chunk.startMs,
        durationMs: chunk.durationMs,
      }),
    }
  )

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    throw new Error(payload?.error || "Couldn't extract transcript audio.")
  }

  return response.arrayBuffer()
}

export const transcribeChunk = async (
  env: TranscriptEnv,
  chunkBuffer: ArrayBuffer
): Promise<ChunkTranscript> => {
  const result = await env.AI.run(TRANSCRIPT_MODEL, {
    audio: Array.from(new Uint8Array(chunkBuffer)),
  })

  return {
    text: result.text,
    words: result.words,
  }
}

export const uploadTranscriptArtifact = async ({
  body,
  contentType,
  uploadUrl,
}: {
  body: string
  contentType: string
  uploadUrl: string
}) => {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": contentType,
    },
    body,
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "")

    throw new Error(errorBody || "Couldn't upload transcript.")
  }
}
