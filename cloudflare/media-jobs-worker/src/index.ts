import {
  Mp4ExportJob,
  handleMp4ExportJobMessage,
  isMp4ExportJobMessage,
  reportMp4ExportJobFailure,
  type Mp4ExportJobMessage,
} from "./jobs/mp4-export-job"
import { getErrorMessage, jsonResponse, type AppJobEnv } from "./jobs/shared"
import {
  TranscriptJob,
  handleTranscriptChunkMessage,
  handleTranscriptJobMessage,
  reportTranscriptChunkFailure,
  reportTranscriptJobFailure,
} from "./jobs/transcript-job"
import {
  isTranscriptChunkMessage,
  isTranscriptJobMessage,
  type TranscriptMessage,
} from "./jobs/transcript-messages"
import {
  handleWaveformJobMessage,
  isWaveformJobMessage,
  reportWaveformJobFailure,
  type WaveformJobMessage,
} from "./jobs/waveform-job"

type MediaJobMessage = WaveformJobMessage | Mp4ExportJobMessage | TranscriptMessage

type QueueBinding<T> = {
  send(message: T): Promise<void>
}

type QueueMessage<T> = {
  body: T
  attempts: number
  ack(): void
  retry(): void
}

type QueueBatch<T> = {
  messages: Array<QueueMessage<T>>
}

type Env = AppJobEnv & {
  AI: Ai
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_STREAM_API_TOKEN: string
  MEDIA_JOBS: QueueBinding<MediaJobMessage>
  MP4_EXPORT_JOB: DurableObjectNamespace
  TRANSCRIPT_JOB: DurableObjectNamespace
}

const MAX_QUEUE_RETRIES = 3
const MAX_QUEUE_ATTEMPTS = MAX_QUEUE_RETRIES + 1

const isAuthorized = (request: Request, token: string) => {
  return request.headers.get("authorization") === `Bearer ${token}`
}

const safeReport = async (label: string, report: () => Promise<void>) => {
  try {
    await report()
  } catch (reportError) {
    console.error(
      getErrorMessage(
        reportError,
        `Unable to report ${label} failure back to the app.`
      )
    )
  }
}

export { Mp4ExportJob }
export { TranscriptJob }

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true })
    }

    if (request.method === "POST" && url.pathname === "/enqueue-waveform") {
      if (!isAuthorized(request, env.MEDIA_JOBS_TOKEN)) {
        return jsonResponse({ error: "Unauthorized" }, { status: 401 })
      }

      const payload = await request.json().catch(() => null)

      if (!isWaveformJobMessage(payload)) {
        return jsonResponse(
          { error: "Invalid waveform job payload." },
          { status: 400 }
        )
      }

      await env.MEDIA_JOBS.send(payload)

      return jsonResponse({ ok: true })
    }

    if (request.method === "POST" && url.pathname === "/enqueue-mp4-export") {
      if (!isAuthorized(request, env.MEDIA_JOBS_TOKEN)) {
        return jsonResponse({ error: "Unauthorized" }, { status: 401 })
      }

      const payload = await request.json().catch(() => null)

      if (!isMp4ExportJobMessage(payload)) {
        return jsonResponse(
          { error: "Invalid MP4 export job payload." },
          { status: 400 }
        )
      }

      await env.MEDIA_JOBS.send(payload)

      return jsonResponse({ ok: true })
    }

    if (request.method === "POST" && url.pathname === "/enqueue-transcript") {
      if (!isAuthorized(request, env.MEDIA_JOBS_TOKEN)) {
        return jsonResponse({ error: "Unauthorized" }, { status: 401 })
      }

      const payload = await request.json().catch(() => null)

      if (!isTranscriptJobMessage(payload)) {
        return jsonResponse(
          { error: "Invalid transcript job payload." },
          { status: 400 }
        )
      }

      await env.MEDIA_JOBS.send(payload)

      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: "Not found" }, { status: 404 })
  },

  async queue(batch: QueueBatch<MediaJobMessage>, env: Env) {
    for (const message of batch.messages) {
      try {
        if (isWaveformJobMessage(message.body)) {
          await handleWaveformJobMessage(env, message.body)
        } else if (isMp4ExportJobMessage(message.body)) {
          await handleMp4ExportJobMessage(env, message.body)
        } else if (isTranscriptJobMessage(message.body)) {
          await handleTranscriptJobMessage(env, message.body)
        } else if (isTranscriptChunkMessage(message.body)) {
          await handleTranscriptChunkMessage(env, message.body)
        } else {
          message.ack()
          continue
        }

        message.ack()
      } catch (error) {
        const errorMessage = getErrorMessage(
          error,
          "Media job processing failed."
        )

        console.error(errorMessage)

        if (message.attempts >= MAX_QUEUE_ATTEMPTS) {
          const body = message.body

          if (isWaveformJobMessage(body)) {
            await safeReport("waveform", () =>
              reportWaveformJobFailure(env, body, errorMessage)
            )
          } else if (isMp4ExportJobMessage(body)) {
            await safeReport("MP4 export job", () =>
              reportMp4ExportJobFailure(env, body.jobId, errorMessage)
            )
          } else if (isTranscriptJobMessage(body)) {
            await safeReport("transcript job", () =>
              reportTranscriptJobFailure(env, body.jobId, errorMessage)
            )
          } else if (isTranscriptChunkMessage(body)) {
            await safeReport("transcript chunk", () =>
              reportTranscriptChunkFailure(env, body, errorMessage)
            )
          }

          message.ack()
          continue
        }

        message.retry()
      }
    }
  },
}
