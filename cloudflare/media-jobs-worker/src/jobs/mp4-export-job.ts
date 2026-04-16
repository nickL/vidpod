import { DurableObject } from "cloudflare:workers"
import {
  fetchApp,
  getErrorMessage,
  jsonResponse,
  trimTrailingSlash,
  type AppJobEnv,
} from "./shared"

const ACTIVE_ATTEMPT_KEY = "active-attempt"
const ATTEMPT_TIMEOUT_MS = 15 * 60 * 1000

export type Mp4ExportJobMessage = {
  jobType: "generate_mp4_export"
  jobId: string
}

type Mp4ExportInput = {
  plan: {
    playbackSessionId: string
    episode: {
      id: string
      title: string
      durationMs?: number
      playbackUrl: string
    }
    resolvedBreaks: Array<{
      adBreakId: string
      requestedTimeMs: number
      selectedVariant: {
        id: string
        adAssetId: string
        adAssetTitle: string
        mediaAsset: {
          id: string
          playbackUrl: string
          durationMs?: number
        }
      }
    }>
  }
  artifact: {
    storage: "r2"
    key: string
    fileName: string
    contentType: "video/mp4"
    uploadUrl: string
  }
}

type Mp4ExportResult = {
  sizeBytes?: number
}

type Mp4ExportJobUpdateResult = {
  error?: string
  claimed?: boolean
  currentStatus?: "queued" | "processing" | "ready" | "failed"
}

type Env = AppJobEnv & {
  MP4_EXPORT_JOB: DurableObjectNamespace
}

type Mp4ExportProgressCallback = {
  jobId: string
  token: string
  url: string
}

type ActiveAttempt = {
  attemptId: string
  startedAtMs?: number
}

const asObject = (value: unknown) =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null

export const isMp4ExportJobMessage = (
  value: unknown
): value is Mp4ExportJobMessage => {
  const job = asObject(value)

  return (
    !!job &&
    job.jobType === "generate_mp4_export" &&
    typeof job.jobId === "string"
  )
}

const updateMp4ExportJob = async (env: Env, body: unknown) => {
  const response = await fetchApp(env, "/api/worker/mp4-export-jobs", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.MEDIA_JOBS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as
    | Mp4ExportJobUpdateResult
    | null

  if (!response.ok) {
    throw new Error(
      payload?.error || "Unable to update MP4 export job state in the app."
    )
  }

  return payload
}

const loadMp4ExportInput = async (
  env: Env,
  jobId: string
): Promise<Mp4ExportInput> => {
  const response = await fetchApp(
    env,
    `/api/worker/mp4-export-jobs/${jobId}/input`,
    {
      headers: {
        authorization: `Bearer ${env.MEDIA_JOBS_TOKEN}`,
      },
    }
  )
  const payload = (await response.json().catch(() => null)) as
    | Mp4ExportInput
    | { error?: string }
    | null

  if (!response.ok || !payload || !("artifact" in payload) || !("plan" in payload)) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : "Unable to load MP4 export job input from the app."
    )
  }

  return payload
}

const requestMp4Export = async (
  env: Env,
  input: Mp4ExportInput,
  progressCallback: Mp4ExportProgressCallback
): Promise<Mp4ExportResult> => {
  const response = await fetch(
    `${trimTrailingSlash(env.TRANSCODER_URL)}/exports/mp4`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.TRANSCODER_AUTH_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        artifact: input.artifact,
        plan: input.plan,
        progressCallback,
      }),
    }
  )
  const payload = (await response.json().catch(() => null)) as
    | Mp4ExportResult
    | { error?: string }
    | null

  if (!response.ok) {
    const errorPayload = payload as { error?: string } | null
    throw new Error(errorPayload?.error || "MP4 export failed.")
  }

  const result = payload as Mp4ExportResult | null

  return {
    sizeBytes: result?.sizeBytes,
  }
}

export const handleMp4ExportJobMessage = async (
  env: Env,
  job: Mp4ExportJobMessage
) => {
  const id = env.MP4_EXPORT_JOB.idFromName(job.jobId)
  const stub = env.MP4_EXPORT_JOB.get(id)
  const response = await stub.fetch("https://mp4-export-job/start", {
    method: "POST",
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    throw new Error(payload?.error || "Unable to start MP4 export job.")
  }
}

export const reportMp4ExportJobFailure = async (
  env: Env,
  jobId: string,
  error: string
) => {
  await updateMp4ExportJob(env, {
    event: "failed",
    jobId,
    error,
    progressMessage: "Something went wrong.",
  })
}

export class Mp4ExportJob extends DurableObject<Env> {
  private activeAttempt?: ActiveAttempt

  private getJobId() {
    return this.ctx.id.name
  }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)

    ctx.blockConcurrencyWhile(async () => {
      this.activeAttempt = await ctx.storage.get<ActiveAttempt>(ACTIVE_ATTEMPT_KEY)
    })
  }

  async fetch(request: Request) {
    const url = new URL(request.url)

    if (request.method === "POST" && url.pathname === "/start") {
      const jobId = this.getJobId()

      if (!jobId) {
        return jsonResponse(
          { error: "MP4 export job id is missing." },
          { status: 500 }
        )
      }

      if (this.activeAttempt) {
        return jsonResponse({ ok: true })
      }

      const attempt: ActiveAttempt = {
        attemptId: crypto.randomUUID(),
      }

      this.activeAttempt = attempt
      await this.ctx.storage.put(ACTIVE_ATTEMPT_KEY, attempt)
      await this.ctx.storage.setAlarm(Date.now())

      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: "Not found" }, { status: 404 })
  }

  async alarm() {
    const attempt = this.activeAttempt
    const jobId = this.getJobId()

    if (!attempt || !jobId) {
      await this.clearAttempt()
      return
    }

    if (!attempt.startedAtMs) {
      const startedAttempt: ActiveAttempt = {
        ...attempt,
        startedAtMs: Date.now(),
      }

      this.activeAttempt = startedAttempt
      await this.ctx.storage.put(ACTIVE_ATTEMPT_KEY, startedAttempt)
      await this.ctx.storage.setAlarm(Date.now() + ATTEMPT_TIMEOUT_MS)
      await this.executeAttempt(jobId, startedAttempt)
      return
    }

    try {
      await updateMp4ExportJob(this.env, {
        event: "failed",
        jobId,
        error: "MP4 export timed out.",
        progressMessage: "Something went wrong.",
      })

      await this.clearAttempt(attempt.attemptId)
    } catch (error) {
      console.error(
        getErrorMessage(
          error,
          "Unable to report MP4 export timeout back to the app."
        )
      )
      throw error
    }
  }

  private isActiveAttempt(attemptId: string) {
    return this.activeAttempt?.attemptId === attemptId
  }

  private async clearAttempt(attemptId?: string) {
    if (attemptId && !this.isActiveAttempt(attemptId)) {
      return
    }

    this.activeAttempt = undefined
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
  }

  private async executeAttempt(jobId: string, attempt: ActiveAttempt) {
    try {
      const claimResult = await updateMp4ExportJob(this.env, {
        event: "processing",
        jobId,
        phase: "preparing",
      })

      if (!this.isActiveAttempt(attempt.attemptId)) {
        return
      }

      // if the app row is 'processing', it means another attempt is already underway
      // We still need to keep this attempt alive so an alarm can still fire if the job stalls/fails.
      if (claimResult?.claimed === false) {
        if (claimResult.currentStatus !== "processing") {
          await this.clearAttempt(attempt.attemptId)
        }
        return
      }

      const input = await loadMp4ExportInput(this.env, jobId)
      const progressCallback = {
        jobId,
        token: this.env.MEDIA_JOBS_TOKEN,
        url: `${trimTrailingSlash(this.env.TRANSCODER_URL)}/exports/mp4/progress`,
      }

      if (!this.isActiveAttempt(attempt.attemptId)) {
        return
      }

      const exportResult = await requestMp4Export(
        this.env,
        input,
        progressCallback
      )

      if (!this.isActiveAttempt(attempt.attemptId)) {
        return
      }

      const { uploadUrl: _uploadUrl, ...artifact } = input.artifact

      await updateMp4ExportJob(this.env, {
        event: "ready",
        jobId,
        output: {
          ...artifact,
          sizeBytes: exportResult.sizeBytes,
        },
        progressMessage: "Your MP4 is ready to download.",
      })

      await this.clearAttempt(attempt.attemptId)
    } catch (error) {
      if (!this.isActiveAttempt(attempt.attemptId)) {
        return
      }

      const errorMessage = getErrorMessage(
        error,
        "MP4 export processing failed."
      )

      try {
        await reportMp4ExportJobFailure(this.env, jobId, errorMessage)
      } catch (updateError) {
        console.error(
          getErrorMessage(
            updateError,
            "Unable to report MP4 export failure back to the app."
          )
        )
        throw updateError
      }

      await this.clearAttempt(attempt.attemptId)
    }
  }
}
