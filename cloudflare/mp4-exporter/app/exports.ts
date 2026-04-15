import { openAsBlob } from "node:fs"
import { mkdir, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { runFfmpeg } from "./ffmpeg.js"
import {
  readOptionalDurationMs,
  readRequiredString,
  readUrl,
} from "./input.js"

const EXPORT_DIR = path.join(tmpdir(), "vidpod-mp4-exporter")
const OUTPUT_HEIGHT = 480
const OUTPUT_WIDTH = 852
const OUTPUT_FPS = 30
const AUDIO_SAMPLE_RATE = 48_000

type ExportPlan = {
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

type UploadArtifact = {
  key: string
  fileName: string
  contentType: string
  uploadUrl: string
}

type ProgressCallback = {
  jobId: string
  token: string
  url: string
}

type GenerateMp4ExportInput = {
  artifact: unknown
  plan: unknown
  progressCallback?: unknown
}

type GenerateMp4ExportResult = {
  sizeBytes: number
}

type Clip =
  | {
      kind: "episode"
      startMs: number
      durationMs: number
    }
  | {
      kind: "ad"
      sourceUrl: string
    }

const parseExportPlan = (value: unknown): ExportPlan => {
  if (!value || typeof value !== "object") {
    throw new Error("Export plan is required")
  }

  const plan = value as Record<string, unknown>
  const episode = plan.episode as Record<string, unknown> | undefined
  const resolvedBreaks = Array.isArray(plan.resolvedBreaks)
    ? plan.resolvedBreaks
    : undefined

  if (!episode || !resolvedBreaks) {
    throw new Error("Export plan is incomplete")
  }

  return {
    playbackSessionId: readRequiredString(
      plan.playbackSessionId,
      "playbackSessionId is required"
    ),
    episode: {
      id: readRequiredString(episode.id, "episode.id is required"),
      title: readRequiredString(episode.title, "episode.title is required"),
      durationMs: readOptionalDurationMs(episode.durationMs),
      playbackUrl: readUrl(
        episode.playbackUrl,
        "episode.playbackUrl is required"
      ),
    },
    resolvedBreaks: resolvedBreaks.map((item) => {
      if (!item || typeof item !== "object") {
        throw new Error("resolvedBreaks contains an invalid item")
      }

      const playbackBreak = item as Record<string, unknown>
      const selectedVariant = playbackBreak.selectedVariant as
        | Record<string, unknown>
        | undefined
      const mediaAsset = selectedVariant?.mediaAsset as
        | Record<string, unknown>
        | undefined

      if (!selectedVariant || !mediaAsset) {
        throw new Error("resolvedBreaks contains an invalid selectedVariant")
      }

      return {
        adBreakId: readRequiredString(playbackBreak.adBreakId, "adBreakId is required"),
        requestedTimeMs: Math.round(Number(playbackBreak.requestedTimeMs ?? 0)),
        selectedVariant: {
          adAssetId: readRequiredString(
            selectedVariant.adAssetId,
            "selectedVariant.adAssetId is required"
          ),
          adAssetTitle: readRequiredString(
            selectedVariant.adAssetTitle,
            "selectedVariant.adAssetTitle is required"
          ),
          mediaAsset: {
            id: readRequiredString(
              mediaAsset.id,
              "selectedVariant.mediaAsset.id is required"
            ),
            playbackUrl: readUrl(
              mediaAsset.playbackUrl,
              "selectedVariant.mediaAsset.playbackUrl is required"
            ),
            durationMs: readOptionalDurationMs(mediaAsset.durationMs),
          },
        },
      }
    }),
  }
}

const parseUploadArtifact = (value: unknown): UploadArtifact => {
  if (!value || typeof value !== "object") {
    throw new Error("artifact is required")
  }

  const artifact = value as Record<string, unknown>

  return {
    key: readRequiredString(artifact.key, "artifact.key is required"),
    fileName: readRequiredString(artifact.fileName, "artifact.fileName is required"),
    contentType: readRequiredString(
      artifact.contentType,
      "artifact.contentType is required"
    ),
    uploadUrl: readUrl(artifact.uploadUrl, "artifact.uploadUrl is required"),
  }
}

const parseProgressCallback = (value: unknown): ProgressCallback | undefined => {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const callback = value as Record<string, unknown>

  return {
    jobId: readRequiredString(callback.jobId, "progressCallback.jobId is required"),
    token: readRequiredString(callback.token, "progressCallback.token is required"),
    url: readUrl(callback.url, "progressCallback.url is required"),
  }
}

const toSeconds = (timeMs: number) => {
  return (timeMs / 1000).toFixed(3)
}

const buildClips = (plan: ExportPlan): Clip[] => {
  const episodeDurationMs = plan.episode.durationMs

  if (!episodeDurationMs) {
    throw new Error("Episode duration is required for MP4 export")
  }

  const breaks = [...plan.resolvedBreaks]
    .filter((playbackBreak) => playbackBreak.requestedTimeMs >= 0)
    .sort((left, right) => left.requestedTimeMs - right.requestedTimeMs)

  const clips: Clip[] = []
  let cursorMs = 0

  for (const playbackBreak of breaks) {
    const breakTimeMs = Math.min(playbackBreak.requestedTimeMs, episodeDurationMs)

    if (breakTimeMs > cursorMs) {
      clips.push({
        kind: "episode",
        startMs: cursorMs,
        durationMs: breakTimeMs - cursorMs,
      })
    }

    clips.push({
      kind: "ad",
      sourceUrl: playbackBreak.selectedVariant.mediaAsset.playbackUrl,
    })

    cursorMs = breakTimeMs
  }

  if (cursorMs < episodeDurationMs) {
    clips.push({
      kind: "episode",
      startMs: cursorMs,
      durationMs: episodeDurationMs - cursorMs,
    })
  }

  if (clips.length === 0) {
    throw new Error("Nothing to export for this playback session")
  }

  return clips
}

const buildFilter = (clips: Clip[]) => {
  const inputs: string[] = []
  const parts: string[] = []
  let adInputIndex = 1

  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index]

    if (clip.kind === "episode") {
      const start = toSeconds(clip.startMs)
      const duration = toSeconds(clip.durationMs)

      parts.push(
        `[0:v:0]trim=start=${start}:duration=${duration},setpts=PTS-STARTPTS,scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${OUTPUT_FPS},format=yuv420p[v${index}]`
      )
      parts.push(
        `[0:a:0]atrim=start=${start}:duration=${duration},asetpts=PTS-STARTPTS,aresample=${AUDIO_SAMPLE_RATE},aformat=sample_fmts=fltp:channel_layouts=stereo[a${index}]`
      )
    } else {
      parts.push(
        `[${adInputIndex}:v:0]setpts=PTS-STARTPTS,scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${OUTPUT_FPS},format=yuv420p[v${index}]`
      )
      parts.push(
        `[${adInputIndex}:a:0]asetpts=PTS-STARTPTS,aresample=${AUDIO_SAMPLE_RATE},aformat=sample_fmts=fltp:channel_layouts=stereo[a${index}]`
      )
      adInputIndex += 1
    }

    inputs.push(`[v${index}][a${index}]`)
  }

  return `${parts.join(";")};${inputs.join("")}concat=n=${clips.length}:v=1:a=1[v][a]`
}

const buildExportArgs = (plan: ExportPlan, clips: Clip[], outputPath: string) => {
  const args = ["-y", "-i", plan.episode.playbackUrl]

  for (const clip of clips) {
    if (clip.kind === "ad") {
      args.push("-i", clip.sourceUrl)
    }
  }

  args.push(
    "-filter_complex",
    buildFilter(clips),
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath
  )

  return args
}

const uploadFile = async ({
  contentType,
  filePath,
  uploadUrl,
}: {
  contentType: string
  filePath: string
  uploadUrl: string
}) => {
  const body = await openAsBlob(filePath)
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": contentType,
    },
    body,
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "")

    throw new Error(errorBody || "Couldn't upload the MP4.")
  }
}

const reportProgress = async (
  progressCallback: ProgressCallback | undefined,
  phase: "rendering" | "uploading"
) => {
  if (!progressCallback) {
    return
  }

  try {
    const response = await fetch(progressCallback.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${progressCallback.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        event: "progress",
        jobId: progressCallback.jobId,
        phase,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "")
      console.error(errorBody || "Couldn't report MP4 progress.")
    }
  } catch (error) {
    console.error("Couldn't report MP4 progress.", error)
  }
}

export const generateMp4Export = async ({
  artifact: rawArtifact,
  plan: rawPlan,
  progressCallback: rawProgressCallback,
}: GenerateMp4ExportInput): Promise<GenerateMp4ExportResult> => {
  const plan = parseExportPlan(rawPlan)
  const artifact = parseUploadArtifact(rawArtifact)
  const progressCallback = parseProgressCallback(rawProgressCallback)
  const tempFilePath = path.join(
    EXPORT_DIR,
    `${artifact.fileName}.${process.pid}.${Date.now()}.tmp.mp4`
  )

  console.log("Starting MP4 export", {
    fileName: artifact.fileName,
    key: artifact.key,
    playbackSessionId: plan.playbackSessionId,
  })

  await mkdir(EXPORT_DIR, { recursive: true })

  try {
    const clips = buildClips(plan)

    await reportProgress(
      progressCallback,
      "rendering"
    )
    await runFfmpeg(buildExportArgs(plan, clips, tempFilePath))

    const fileStats = await stat(tempFilePath)

    await reportProgress(
      progressCallback,
      "uploading"
    )
    await uploadFile({
      contentType: artifact.contentType,
      filePath: tempFilePath,
      uploadUrl: artifact.uploadUrl,
    })

    console.log("Uploaded MP4 export artifact", {
      fileName: artifact.fileName,
      key: artifact.key,
      playbackSessionId: plan.playbackSessionId,
      sizeBytes: fileStats.size,
    })

    return {
      sizeBytes: fileStats.size,
    }
  } finally {
    await rm(tempFilePath, { force: true }).catch(() => undefined)
  }
}
