import { spawn } from "node:child_process"

export const runFfmpeg = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args)
    const stderrChunks: Buffer[] = []

    child.stderr.on("data", (chunk) => {
      stderrChunks.push(Buffer.from(chunk))
    })

    child.on("error", reject)

    child.on("close", (code) => {
      const stderr = Buffer.concat(stderrChunks).toString("utf8")

      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr.trim() || "ffmpeg failed."))
    })
  })
