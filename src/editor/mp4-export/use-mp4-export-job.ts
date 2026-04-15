"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  startMp4ExportJobAction,
  startPlaybackSessionAction,
} from "../actions"

import type { Mp4ExportJob } from "../types"

type UseMp4ExportJobOptions = {
  episodeId: string
  previewConfigKey: string
}

const JOB_POLL_MS = 2_000

const getJobStorageKey = (episodeId: string) =>
  `vidpod:mp4-export-job:${episodeId}`

const getSessionStorageKey = (episodeId: string) =>
  `vidpod:playback-session:${episodeId}`

export const useMp4ExportJob = ({
  episodeId,
  previewConfigKey,
}: UseMp4ExportJobOptions) => {
  const queryClient = useQueryClient()
  const previewConfigKeyRef = useRef(previewConfigKey)
  const [jobId, setJobId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined
    return window.sessionStorage.getItem(getJobStorageKey(episodeId)) ?? undefined
  })
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string>()

  useEffect(() => {
    if (previewConfigKeyRef.current === previewConfigKey) {
      return
    }

    previewConfigKeyRef.current = previewConfigKey
    window.sessionStorage.removeItem(getJobStorageKey(episodeId))
    setJobId(undefined)
    setStartError(undefined)
  }, [episodeId, previewConfigKey])

  const jobQuery = useQuery<Mp4ExportJob>({
    queryKey: ["mp4-export-job", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/mp4-export-jobs/${jobId}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Couldn't load the MP4 export job.")
      }

      return response.json()
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "queued" || status === "processing" ? JOB_POLL_MS : false
    },
  })

  const start = useCallback(async () => {
    const requestConfigKey = previewConfigKeyRef.current
    const isStaleRequest = () => requestConfigKey !== previewConfigKeyRef.current

    setIsStarting(true)
    setStartError(undefined)

    try {
      const storedSessionId =
        window.sessionStorage.getItem(getSessionStorageKey(episodeId)) ?? undefined

      const sessionStart = await startPlaybackSessionAction({
        episodeId,
        playbackSessionId: storedSessionId,
        playheadTimeMs: 0,
      })

      if (isStaleRequest()) {
        return
      }

      window.sessionStorage.setItem(
        getSessionStorageKey(episodeId),
        sessionStart.session.id
      )

      const job = await startMp4ExportJobAction(sessionStart.session.id)

      if (isStaleRequest()) {
        return
      }

      window.sessionStorage.setItem(getJobStorageKey(episodeId), job.id)
      queryClient.setQueryData(["mp4-export-job", job.id], job)
      setJobId(job.id)
    } catch (error) {
      if (isStaleRequest()) {
        return
      }

      setStartError(
        error instanceof Error ? error.message : "Couldn't start the MP4 export."
      )
    } finally {
      setIsStarting(false)
    }
  }, [episodeId, queryClient])

  const regenerate = useCallback(async () => {
    window.sessionStorage.removeItem(getJobStorageKey(episodeId))
    setJobId(undefined)
    await start()
  }, [episodeId, start])

  const job = jobQuery.data
  const error =
    startError ?? (job?.status === "failed" ? job.error : undefined)

  return {
    job,
    isStarting,
    error,
    start,
    regenerate,
  }
}
