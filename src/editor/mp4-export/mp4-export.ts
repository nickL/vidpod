import "server-only"

import { serverEnv } from "@/env/server"

import { getMp4Plan } from "../playback/playback-sessions"

import type { Mp4Export } from "../types"

const getExportError = async (response: Response) => {
  try {
    const payload = (await response.json()) as { error?: string }

    return payload.error ?? `MP4 export failed with ${response.status}.`
  } catch {
    return `MP4 export failed with ${response.status}.`
  }
}

export const generateMp4Export = async (
  playbackSessionId: string
): Promise<Mp4Export> => {
  const transcoderUrl = serverEnv.transcoderUrl
  const transcoderAuthToken = serverEnv.transcoderAuthToken

  if (!transcoderUrl || !transcoderAuthToken) {
    throw new Error("Transcoder is not configured for MP4 export.")
  }

  const plan = await getMp4Plan(playbackSessionId)
  const response = await fetch(
    `${transcoderUrl.replace(/\/$/, "")}/exports/mp4`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${transcoderAuthToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(plan),
    }
  )

  if (!response.ok) {
    throw new Error(await getExportError(response))
  }

  return response.json() as Promise<Mp4Export>
}
