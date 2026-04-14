type GenerateWaveformJob = {
  jobType: "generate_waveform"
  mediaAssetId: string
  sourceUrl: string
  bucketCount: number
}

type MediaJobMessage = GenerateWaveformJob

type WaveformResponse = {
  bucketCount: number
  peaks: number[]
}

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

type Env = {
  MEDIA_JOBS: QueueBinding<MediaJobMessage>
  MEDIA_JOBS_TOKEN: string
  TRANSCODER_URL: string
  TRANSCODER_AUTH_TOKEN: string
  APP_INTERNAL_BASE_URL: string
}

const MAX_QUEUE_RETRIES = 3
const MAX_QUEUE_ATTEMPTS = MAX_QUEUE_RETRIES + 1

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "")

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  })

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  return error instanceof Error && error.message
    ? error.message
    : fallbackMessage
}

const isAuthorized = (request: Request, token: string) => {
  return request.headers.get("authorization") === `Bearer ${token}`
}

const isGenerateWaveformJob = (value: unknown): value is GenerateWaveformJob => {
  if (!value || typeof value !== "object") {
    return false
  }

  const payload = value as Record<string, unknown>

  return (
    payload.jobType === "generate_waveform" &&
    typeof payload.mediaAssetId === "string" &&
    typeof payload.sourceUrl === "string" &&
    typeof payload.bucketCount === "number"
  )
}

const postWaveformUpdate = async (env: Env, body: unknown) => {
  const response = await fetch(
    `${trimTrailingSlash(env.APP_INTERNAL_BASE_URL)}/api/internal/media-waveforms`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.MEDIA_JOBS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    throw new Error(
      payload?.error || "Unable to update waveform state in the app."
    )
  }
}

const requestWaveform = async (
  env: Env,
  job: GenerateWaveformJob
): Promise<WaveformResponse> => {
  const response = await fetch(
    `${trimTrailingSlash(env.TRANSCODER_URL)}/waveforms`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.TRANSCODER_AUTH_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sourceUrl: job.sourceUrl,
        bucketCount: job.bucketCount,
      }),
    }
  )
  const payload = (await response.json().catch(() => null)) as
    | WaveformResponse
    | { error?: string }
    | null

  if (!response.ok || !payload || !("peaks" in payload)) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : "Waveform generation failed."
    )
  }

  return payload
}

const handleGenerateWaveformJob = async (env: Env, job: GenerateWaveformJob) => {
  await postWaveformUpdate(env, {
    event: "processing",
    mediaAssetId: job.mediaAssetId,
  })

  const waveform = await requestWaveform(env, job)

  await postWaveformUpdate(env, {
    event: "ready",
    mediaAssetId: job.mediaAssetId,
    peaks: waveform.peaks,
    bucketCount: waveform.bucketCount,
  })
}

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

      if (!isGenerateWaveformJob(payload)) {
        return jsonResponse(
          { error: "Invalid waveform job payload." },
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
      if (!isGenerateWaveformJob(message.body)) {
        message.ack()
        continue
      }

      try {
        await handleGenerateWaveformJob(env, message.body)
        message.ack()
      } catch (error) {
        const errorMessage = getErrorMessage(
          error,
          "Waveform job processing failed."
        )

        console.error(errorMessage)

        if (message.attempts >= MAX_QUEUE_ATTEMPTS) {
          try {
            await postWaveformUpdate(env, {
              event: "failed",
              mediaAssetId: message.body.mediaAssetId,
              error: errorMessage,
            })
          } catch (updateError) {
            console.error(
              getErrorMessage(
                updateError,
                "Unable to report waveform failure back to the app."
              )
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
