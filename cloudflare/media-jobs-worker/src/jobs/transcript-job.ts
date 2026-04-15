import { DurableObject } from "cloudflare:workers"

import { getErrorMessage, jsonResponse } from "./shared"
import {
  mergeTranscriptResults,
  type TranscriptChunkResult,
  type TranscriptWord,
} from "./transcript-assembly"
import {
  buildChunkMessages,
  type TranscriptChunkMessage,
  type TranscriptJobMessage,
} from "./transcript-messages"
import {
  loadTranscriptJobInput,
  loadTranscriptAudioUrl,
  requestTranscriptChunkAudio,
  transcribeChunk,
  updateTranscriptJob,
  uploadTranscriptArtifact,
  type ChunkTranscript,
  type TranscriptEnv,
  type TranscriptJobInput,
} from "./transcript-transport"

const ACTIVE_ATTEMPT_KEY = "active-attempt"
const ATTEMPT_TIMEOUT_MS = 7_200_000
const CHUNK_RESULT_KEY_PREFIX = "chunk-result:"

type ChunkCompletePayload = {
  attemptId: string
  result: TranscriptChunkResult
}

type ChunkFailedPayload = {
  attemptId: string
  error: string
}

type ActiveAttempt = {
  attemptId: string
  completedChunks: number
  input?: TranscriptJobInput
  pendingAssembly?: boolean
  startedAtMs?: number
}

const asObject = (value: unknown) =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null

const buildChunkResultKey = (chunkIndex: number) =>
  `${CHUNK_RESULT_KEY_PREFIX}${chunkIndex}`

const readChunkResult = (storage: DurableObjectStorage, chunkIndex: number) =>
  storage.get<TranscriptChunkResult>(buildChunkResultKey(chunkIndex))

const toTranscriptWords = (words: ChunkTranscript["words"]): TranscriptWord[] =>
  (words ?? []).flatMap((word) =>
    typeof word.word === "string" &&
    typeof word.start === "number" &&
    typeof word.end === "number"
      ? [{ word: word.word, start: word.start, end: word.end }]
      : []
  )

const isTranscriptWord = (value: unknown): value is TranscriptWord => {
  const word = asObject(value)

  return (
    !!word &&
    typeof word.word === "string" &&
    typeof word.start === "number" &&
    typeof word.end === "number"
  )
}

const isChunkResult = (value: unknown): value is TranscriptChunkResult => {
  const result = asObject(value)

  return (
    !!result &&
    typeof result.chunkIndex === "number" &&
    typeof result.durationMs === "number" &&
    typeof result.startMs === "number" &&
    typeof result.text === "string" &&
    Array.isArray(result.words) &&
    result.words.every(isTranscriptWord)
  )
}

const parseChunkCompletePayload = (value: unknown): ChunkCompletePayload | null => {
  const payload = asObject(value)

  if (!payload || typeof payload.attemptId !== "string" || !isChunkResult(payload.result)) {
    return null
  }

  return payload as ChunkCompletePayload
}

const parseChunkFailedPayload = (value: unknown): ChunkFailedPayload | null => {
  const payload = asObject(value)

  if (!payload || typeof payload.attemptId !== "string" || typeof payload.error !== "string") {
    return null
  }

  return payload as ChunkFailedPayload
}

export const handleTranscriptJobMessage = async (
  env: TranscriptEnv,
  job: TranscriptJobMessage
) => {
  const id = env.TRANSCRIPT_JOB.idFromName(job.jobId)
  const stub = env.TRANSCRIPT_JOB.get(id)
  const response = await stub.fetch("https://transcript-job/start", {
    method: "POST",
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    throw new Error(payload?.error || "Couldn't start the transcript.")
  }
}

export const handleTranscriptChunkMessage = async (
  env: TranscriptEnv,
  chunk: TranscriptChunkMessage
) => {
  const chunkBuffer = await requestTranscriptChunkAudio(env, chunk)
  const transcription = await transcribeChunk(env, chunkBuffer)
  const id = env.TRANSCRIPT_JOB.idFromName(chunk.jobId)
  const stub = env.TRANSCRIPT_JOB.get(id)
  const response = await stub.fetch("https://transcript-job/chunks/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      attemptId: chunk.attemptId,
      result: {
        chunkIndex: chunk.chunkIndex,
        durationMs: chunk.durationMs,
        startMs: chunk.startMs,
        text: transcription.text,
        words: toTranscriptWords(transcription.words),
      },
    } satisfies ChunkCompletePayload),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    throw new Error(payload?.error || "Couldn't save transcript chunk.")
  }
}

export const reportTranscriptJobFailure = async (
  env: TranscriptEnv,
  jobId: string,
  error: string
) => {
  await updateTranscriptJob(env, {
    event: "failed",
    jobId,
    error,
  })
}

export const reportTranscriptChunkFailure = async (
  env: TranscriptEnv,
  chunk: TranscriptChunkMessage,
  error: string
) => {
  const id = env.TRANSCRIPT_JOB.idFromName(chunk.jobId)
  const stub = env.TRANSCRIPT_JOB.get(id)
  const response = await stub.fetch("https://transcript-job/chunks/failed", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      attemptId: chunk.attemptId,
      error,
    } satisfies ChunkFailedPayload),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    throw new Error(
      payload?.error || "Couldn't report transcript chunk failure."
    )
  }
}

export class TranscriptJob extends DurableObject<TranscriptEnv> {
  private activeAttempt?: ActiveAttempt

  constructor(ctx: DurableObjectState, env: TranscriptEnv) {
    super(ctx, env)

    ctx.blockConcurrencyWhile(async () => {
      this.activeAttempt = await ctx.storage.get<ActiveAttempt>(ACTIVE_ATTEMPT_KEY)
    })
  }

  private getJobId() {
    return this.ctx.id.name
  }

  async fetch(request: Request) {
    const url = new URL(request.url)

    if (request.method === "POST" && url.pathname === "/start") {
      const jobId = this.getJobId()

      if (!jobId) {
        return jsonResponse(
          { error: "Transcript job id is missing." },
          { status: 500 }
        )
      }

      if (this.activeAttempt) {
        return jsonResponse({ ok: true })
      }

      const attempt: ActiveAttempt = {
        attemptId: crypto.randomUUID(),
        completedChunks: 0,
      }

      this.activeAttempt = attempt
      await this.ctx.storage.put(ACTIVE_ATTEMPT_KEY, attempt)
      await this.ctx.storage.setAlarm(Date.now())

      return jsonResponse({ ok: true })
    }

    if (request.method === "POST" && url.pathname === "/chunks/complete") {
      const payload = parseChunkCompletePayload(
        await request.json().catch(() => null)
      )

      if (!payload) {
        return jsonResponse({ error: "Invalid payload." }, { status: 400 })
      }

      await this.handleChunkComplete(payload)

      return jsonResponse({ ok: true })
    }

    if (request.method === "POST" && url.pathname === "/chunks/failed") {
      const payload = parseChunkFailedPayload(
        await request.json().catch(() => null)
      )

      if (!payload) {
        return jsonResponse({ error: "Invalid payload." }, { status: 400 })
      }

      await this.handleChunkFailure(payload)

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
      await this.beginAttempt(jobId, attempt)
      return
    }

    if (attempt.pendingAssembly) {
      await this.assembleAttempt(jobId, attempt)
      return
    }

    try {
      await reportTranscriptJobFailure(this.env, jobId, "Transcript timed out.")
      await this.clearAttempt(attempt.attemptId)
    } catch (error) {
      console.error(
        getErrorMessage(error, "Couldn't report transcript timeout.")
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

  private async beginAttempt(jobId: string, attempt: ActiveAttempt) {
    try {
      const input = await loadTranscriptJobInput(this.env, jobId)
      const claimResult = await updateTranscriptJob(this.env, {
        event: "processing",
        jobId,
        phase: "extracting",
        totalChunks: input.totalChunks,
      })

      if (!this.isActiveAttempt(attempt.attemptId)) {
        return
      }

      if (claimResult?.claimed === false) {
        if (claimResult.currentStatus !== "processing") {
          await this.clearAttempt(attempt.attemptId)
        }
        return
      }

      const startedAttempt: ActiveAttempt = {
        ...attempt,
        startedAtMs: Date.now(),
        input,
      }

      this.activeAttempt = startedAttempt
      await this.ctx.storage.put(ACTIVE_ATTEMPT_KEY, startedAttempt)
      await this.ctx.storage.setAlarm(Date.now() + ATTEMPT_TIMEOUT_MS)

      const audioUrl = await loadTranscriptAudioUrl(
        this.env,
        input.streamVideoId
      )

      await updateTranscriptJob(this.env, {
        event: "progress",
        jobId,
        phase: "transcribing",
        totalChunks: input.totalChunks,
        completedChunks: 0,
      })

      const messages = buildChunkMessages({
        audioUrl,
        attemptId: attempt.attemptId,
        chunkDurationMs: input.chunkDurationMs,
        chunkOverlapMs: input.chunkOverlapMs,
        durationMs: input.durationMs,
        jobId,
        totalChunks: input.totalChunks,
      })

      for (const message of messages) {
        await this.env.MEDIA_JOBS.send(message)
      }
    } catch (error) {
      if (!this.isActiveAttempt(attempt.attemptId)) {
        return
      }

      const errorMessage = getErrorMessage(
        error,
        "Couldn't process the transcript."
      )

      try {
        await reportTranscriptJobFailure(this.env, jobId, errorMessage)
      } catch (updateError) {
        console.error(
          getErrorMessage(updateError, "Couldn't report transcript failure.")
        )
        throw updateError
      }

      await this.clearAttempt(attempt.attemptId)
    }
  }

  private async handleChunkComplete(payload: ChunkCompletePayload) {
    const attempt = this.activeAttempt
    const jobId = this.getJobId()

    if (
      !attempt ||
      !jobId ||
      !this.isActiveAttempt(payload.attemptId) ||
      !attempt.input
    ) {
      return
    }

    const existingResult = await readChunkResult(
      this.ctx.storage,
      payload.result.chunkIndex
    )

    if (existingResult) {
      return
    }

    const nextCompletedChunks = attempt.completedChunks + 1
    const nextAttempt: ActiveAttempt = {
      ...attempt,
      completedChunks: nextCompletedChunks,
      pendingAssembly: nextCompletedChunks >= attempt.input.totalChunks,
    }

    await this.ctx.storage.put(
      buildChunkResultKey(payload.result.chunkIndex),
      payload.result
    )

    this.activeAttempt = nextAttempt
    await this.ctx.storage.put(ACTIVE_ATTEMPT_KEY, nextAttempt)

    if (nextAttempt.pendingAssembly) {
      await this.ctx.storage.setAlarm(Date.now())
      return
    }

    await updateTranscriptJob(this.env, {
      event: "progress",
      jobId,
      phase: "transcribing",
      totalChunks: attempt.input.totalChunks,
      completedChunks: nextCompletedChunks,
    })
  }

  private async handleChunkFailure(payload: ChunkFailedPayload) {
    const attempt = this.activeAttempt
    const jobId = this.getJobId()

    if (!attempt || !jobId || !this.isActiveAttempt(payload.attemptId)) {
      return
    }

    await reportTranscriptJobFailure(this.env, jobId, payload.error)
    await this.clearAttempt(payload.attemptId)
  }

  private async assembleAttempt(jobId: string, attempt: ActiveAttempt) {
    if (!attempt.input) {
      await reportTranscriptJobFailure(
        this.env,
        jobId,
        "Transcript input is missing."
      )
      await this.clearAttempt(attempt.attemptId)
      return
    }

    try {
      await updateTranscriptJob(this.env, {
        event: "progress",
        jobId,
        phase: "building",
        totalChunks: attempt.input.totalChunks,
        completedChunks: attempt.completedChunks,
      })

      const chunkResults: TranscriptChunkResult[] = []

      for (let chunkIndex = 0; chunkIndex < attempt.input.totalChunks; chunkIndex += 1) {
        const chunkResult = await readChunkResult(this.ctx.storage, chunkIndex)

        if (!chunkResult) {
          throw new Error("Transcript chunk result is missing.")
        }

        chunkResults.push(chunkResult)
      }

      const transcript = mergeTranscriptResults(
        chunkResults,
        attempt.input.chunkOverlapMs
      )

      await uploadTranscriptArtifact({
        body: JSON.stringify(transcript.words),
        contentType: attempt.input.wordsArtifact.contentType,
        uploadUrl: attempt.input.wordsArtifact.uploadUrl,
      })

      const { uploadUrl: _wordsUploadUrl, ...wordsArtifact } =
        attempt.input.wordsArtifact

      await updateTranscriptJob(this.env, {
        event: "ready",
        jobId,
        text: transcript.text,
        wordsArtifact,
      })

      await this.clearAttempt(attempt.attemptId)
    } catch (error) {
      if (!this.isActiveAttempt(attempt.attemptId)) {
        return
      }

      const errorMessage = getErrorMessage(
        error,
        "Couldn't build the transcript."
      )

      try {
        await reportTranscriptJobFailure(this.env, jobId, errorMessage)
      } catch (updateError) {
        console.error(
          getErrorMessage(updateError, "Couldn't report transcript failure.")
        )
        throw updateError
      }

      await this.clearAttempt(attempt.attemptId)
    }
  }
}
