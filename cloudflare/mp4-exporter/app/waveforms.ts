import { spawn } from "node:child_process"

const DEFAULT_BUCKET_COUNT = 1024
const MIN_BUCKET_COUNT = 64
const MAX_BUCKET_COUNT = 4096
const SAMPLE_RATE = 4000
const PEAK_SCALE = 1000

type GenerateWaveformInput = {
  bucketCount?: number
  sourceUrl: string
}

type CommandResult = {
  stdout: Buffer
}

export type WaveformResult = {
  bucketCount: number
  durationMs: number
  peaks: number[]
}

const clampBucketCount = (value?: number) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_BUCKET_COUNT
  }

  return Math.max(MIN_BUCKET_COUNT, Math.min(MAX_BUCKET_COUNT, Math.round(value!)))
}

const assertSourceUrl = (value: string) => {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(value)
  } catch {
    throw new Error("sourceUrl must be a valid URL")
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("sourceUrl must use http or https")
  }
}

const runCommand = (command: string, args: string[]) =>
  new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, args)
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk)
    })

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk)
    })

    child.on("error", reject)

    child.on("close", (code) => {
      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim()

      if (code !== 0) {
        reject(new Error(stderr || `${command} exited with code ${code}`))
        return
      }

      resolve({
        stdout: Buffer.concat(stdoutChunks),
      })
    })
  })

const decodeAudio = async (sourceUrl: string) => {
  const { stdout } = await runCommand("ffmpeg", [
    "-v",
    "error",
    "-i",
    sourceUrl,
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(SAMPLE_RATE),
    "-f",
    "s16le",
    "pipe:1",
  ])

  if (stdout.byteLength < 2) {
    throw new Error("No audio samples were produced for waveform generation")
  }

  const evenByteLength = stdout.byteLength - (stdout.byteLength % 2)

  return new Int16Array(stdout.buffer, stdout.byteOffset, evenByteLength / 2)
}

const bucketPeaks = (samples: Int16Array, bucketCount: number) => {
  const peaks = new Array<number>(bucketCount).fill(0)
  const samplesPerBucket = samples.length / bucketCount
  let maxPeak = 0

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const start = Math.floor(bucketIndex * samplesPerBucket)
    const end = Math.max(start + 1, Math.floor((bucketIndex + 1) * samplesPerBucket))
    let bucketPeak = 0

    for (
      let sampleIndex = start;
      sampleIndex < end && sampleIndex < samples.length;
      sampleIndex += 1
    ) {
      const sample = Math.abs(samples[sampleIndex] ?? 0)

      if (sample > bucketPeak) {
        bucketPeak = sample
      }
    }

    peaks[bucketIndex] = bucketPeak

    if (bucketPeak > maxPeak) {
      maxPeak = bucketPeak
    }
  }

  if (maxPeak === 0) {
    return peaks
  }

  return peaks.map((peak) => Math.round(Math.sqrt(peak / maxPeak) * PEAK_SCALE))
}

export const generateWaveform = async ({
  bucketCount,
  sourceUrl,
}: GenerateWaveformInput): Promise<WaveformResult> => {
  assertSourceUrl(sourceUrl)

  const finalBucketCount = clampBucketCount(bucketCount)
  const samples = await decodeAudio(sourceUrl)

  return {
    bucketCount: finalBucketCount,
    durationMs: Math.round((samples.length / SAMPLE_RATE) * 1000),
    peaks: bucketPeaks(samples, finalBucketCount),
  }
}
