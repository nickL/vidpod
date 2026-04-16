import { fetchApp, trimTrailingSlash, type AppJobEnv } from "./shared"

export type WaveformJobMessage = {
  jobType: "generate_waveform"
  mediaAssetId: string
  sourceUrl: string
  bucketCount: number
}

type WaveformResponse = {
  bucketCount: number
  peaks: number[]
}

const asObject = (value: unknown) =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null

export const isWaveformJobMessage = (
  value: unknown
): value is WaveformJobMessage => {
  const job = asObject(value)

  return (
    !!job &&
    job.jobType === "generate_waveform" &&
    typeof job.mediaAssetId === "string" &&
    typeof job.sourceUrl === "string" &&
    typeof job.bucketCount === "number"
  )
}

const postWaveformUpdate = async (env: AppJobEnv, body: unknown) => {
  const response = await fetchApp(env, "/api/worker/media-waveforms", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.MEDIA_JOBS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

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
  env: AppJobEnv,
  job: WaveformJobMessage
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

export const handleWaveformJobMessage = async (
  env: AppJobEnv,
  job: WaveformJobMessage
) => {
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

export const reportWaveformJobFailure = async (
  env: AppJobEnv,
  job: WaveformJobMessage,
  error: string
) => {
  await postWaveformUpdate(env, {
    event: "failed",
    mediaAssetId: job.mediaAssetId,
    error,
  })
}
