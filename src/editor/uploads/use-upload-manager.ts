"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import * as tus from "tus-js-client"

import {
  failUploadAction,
  refreshUploadedAssetAction,
  removeEpisodeVideoAction,
  resetDemoEpisodeAction,
  setCurrentEpisodeVideoAction,
  startUploadAction,
} from "../actions"
import { episodeEditorQueryKey } from "../queries"
import { useEditorCache } from "../use-editor-cache"

import type {
  AdLibraryItem,
  EpisodeVideoAsset,
  UploadProgressState,
  UploadTarget,
} from "../types"

const MAX_POLL_FAILURES = 5

export const useUploadManager = ({
  episodeId,
  adLibrary,
  episodeVideoAssets,
}: {
  episodeId: string
  adLibrary?: AdLibraryItem[]
  episodeVideoAssets?: EpisodeVideoAsset[]
}) => {
  const queryClient = useQueryClient()
  const queryKey = episodeEditorQueryKey(episodeId)
  const cache = useEditorCache(episodeId)
  const pollTimeoutsRef = useRef<Record<string, number | undefined>>({})
  const pollFailureCountsRef = useRef<Record<string, number>>({})
  const [uploadProgressByMediaAssetId, setProgressByMediaAssetId] =
    useState<Record<string, UploadProgressState>>({})
  const [uploadErrorByTarget, setErrorByTarget] = useState<
    Partial<Record<UploadTarget, string>>
  >({})
  const [isResettingDemo, setIsResettingDemo] = useState(false)

  useEffect(() => {
    const uploadPollTimeouts = pollTimeoutsRef.current
    const uploadPollFailureCounts = pollFailureCountsRef.current

    return () => {
      for (const timeoutId of Object.values(uploadPollTimeouts)) {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId)
        }
      }

      for (const mediaAssetId of Object.keys(uploadPollFailureCounts)) {
        delete uploadPollFailureCounts[mediaAssetId]
      }
    }
  }, [])

  const setProgress = useCallback(
    (
      mediaAssetId: string,
      uploadProgress: UploadProgressState | undefined
    ) => {
      setProgressByMediaAssetId((currentProgress) => {
        if (!uploadProgress) {
          if (!currentProgress[mediaAssetId]) {
            return currentProgress
          }

          const nextProgress = { ...currentProgress }

          delete nextProgress[mediaAssetId]
          return nextProgress
        }

        return {
          ...currentProgress,
          [mediaAssetId]: uploadProgress,
        }
      })
    },
    []
  )

  const setError = useCallback(
    (target: UploadTarget, message?: string) => {
      setErrorByTarget((currentErrors) => {
        if (!message) {
          if (!currentErrors[target]) {
            return currentErrors
          }

          const nextErrors = { ...currentErrors }

          delete nextErrors[target]
          return nextErrors
        }

        return {
          ...currentErrors,
          [target]: message,
        }
      })
    },
    []
  )

  const clearPolling = useCallback((mediaAssetId: string) => {
    const timeoutId = pollTimeoutsRef.current[mediaAssetId]

    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
      delete pollTimeoutsRef.current[mediaAssetId]
    }

    delete pollFailureCountsRef.current[mediaAssetId]
  }, [])

  const handleFailure = useCallback(
    async (mediaAssetId: string) => {
      clearPolling(mediaAssetId)

      try {
        await failUploadAction(mediaAssetId)
      } catch {
        // If the server write fails, still flip the UI to the failed state.
      }

      cache.mediaAssets.setStatus(mediaAssetId, "failed")
      setProgress(mediaAssetId, undefined)
      queryClient.invalidateQueries({ queryKey })
    },
    [cache.mediaAssets, clearPolling, queryClient, queryKey, setProgress]
  )

  const pollStatus = useCallback(
    async ({
      target,
      assetId,
      mediaAssetId,
    }: {
      target: UploadTarget
      assetId: string
      mediaAssetId: string
    }) => {
      try {
        let mediaStatus: UploadProgressState["phase"] | "ready" | "failed"

        if (target === "episode") {
          const result = (await refreshUploadedAssetAction({
            target: "episode",
            assetId,
          })) as {
            target: "episode"
            episodeVideoAsset?: EpisodeVideoAsset
          }

          if (!result.episodeVideoAsset) {
            throw new Error("Episode upload did not return refreshed media")
          }

          cache.episodeVideos.save(result.episodeVideoAsset)
          mediaStatus = result.episodeVideoAsset.mediaAsset.status
        } else {
          const result = (await refreshUploadedAssetAction({
            target: "ad",
            assetId,
          })) as {
            target: "ad"
            adLibraryItem?: AdLibraryItem
          }

          if (!result.adLibraryItem) {
            throw new Error("Ad upload did not return refreshed media")
          }

          cache.adLibrary.save(result.adLibraryItem)
          mediaStatus = result.adLibraryItem.mediaAsset.status
        }

        pollFailureCountsRef.current[mediaAssetId] = 0

        if (mediaStatus === "ready" || mediaStatus === "failed") {
          clearPolling(mediaAssetId)
          setProgress(mediaAssetId, undefined)
          queryClient.invalidateQueries({ queryKey })
          return
        }

        setProgress(mediaAssetId, {
          phase: "processing",
          progressPercent: 100,
        })
      } catch {
        const failureCount =
          (pollFailureCountsRef.current[mediaAssetId] ?? 0) + 1

        pollFailureCountsRef.current[mediaAssetId] = failureCount

        if (failureCount >= MAX_POLL_FAILURES) {
          await handleFailure(mediaAssetId)
          return
        }
      }

      const nextTimeoutId = window.setTimeout(() => {
        pollStatus({
          target,
          assetId,
          mediaAssetId,
        })
      }, 1500)

      pollTimeoutsRef.current[mediaAssetId] = nextTimeoutId
    },
    [
      cache.adLibrary,
      cache.episodeVideos,
      clearPolling,
      handleFailure,
      queryClient,
      queryKey,
      setProgress,
    ]
  )

  useEffect(() => {
    const recoverableUploads = [
      ...(episodeVideoAssets ?? []).map((episodeVideoAsset) => ({
        target: "episode" as const,
        assetId: episodeVideoAsset.id,
        mediaAssetId: episodeVideoAsset.mediaAsset.id,
        status: episodeVideoAsset.mediaAsset.status,
      })),
      ...(adLibrary ?? []).map((adLibraryItem) => ({
        target: "ad" as const,
        assetId: adLibraryItem.id,
        mediaAssetId: adLibraryItem.mediaAsset.id,
        status: adLibraryItem.mediaAsset.status,
      })),
    ].filter((upload) => {
      if (uploadProgressByMediaAssetId[upload.mediaAssetId]) {
        return false
      }

      return upload.status === "uploading" || upload.status === "processing"
    })

    if (recoverableUploads.length === 0) {
      return
    }

    const recoverUploads = async () => {
      for (const upload of recoverableUploads) {
        if (pollTimeoutsRef.current[upload.mediaAssetId] !== undefined) {
          continue
        }

        await pollStatus(upload)
      }
    }

    recoverUploads().catch(() => undefined)
  }, [adLibrary, episodeVideoAssets, pollStatus, uploadProgressByMediaAssetId])

  const uploadFile = useCallback(
    async (target: UploadTarget, file: File) => {
      let mediaAssetId: string | undefined

      try {
        setError(target, undefined)

        const uploadStart = await startUploadAction({
          target,
          episodeId,
          filename: file.name,
          fileSize: file.size,
        })

        mediaAssetId =
          uploadStart.target === "episode"
            ? uploadStart.episodeVideoAsset.mediaAsset.id
            : uploadStart.adLibraryItem.mediaAsset.id
        const assetId =
          uploadStart.target === "episode"
            ? uploadStart.episodeVideoAsset.id
            : uploadStart.adLibraryItem.id
        const uploadMediaAssetId = mediaAssetId

        if (uploadStart.target === "episode") {
          cache.episodeVideos.save(uploadStart.episodeVideoAsset)
          queryClient.invalidateQueries({ queryKey })
        } else {
          cache.adLibrary.save(uploadStart.adLibraryItem)
        }

        setProgress(uploadMediaAssetId, {
          phase: "uploading",
          progressPercent: 0,
        })

        const upload = new tus.Upload(file, {
          uploadUrl: uploadStart.uploadUrl,
          retryDelays: [0, 1000, 3000, 5000],
          removeFingerprintOnSuccess: true,
          storeFingerprintForResuming: false,
          metadata: {
            filename: file.name,
            filetype: file.type,
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            setProgress(uploadMediaAssetId, {
              phase: "uploading",
              progressPercent: Math.round((bytesUploaded / bytesTotal) * 100),
            })
          },
          onSuccess: () => {
            setProgress(uploadMediaAssetId, {
              phase: "processing",
              progressPercent: 100,
            })
            pollStatus({
              target,
              assetId,
              mediaAssetId: uploadMediaAssetId,
            })
          },
          onError: async () => {
            await handleFailure(uploadMediaAssetId)
            setError(target, "Upload failed. Try again.")
          },
        })

        upload.start()
      } catch (error) {
        if (mediaAssetId) {
          await handleFailure(mediaAssetId)
        }

        setError(
          target,
          error instanceof Error ? error.message : "Unable to start upload."
        )
        console.error(error)
      }
    },
    [
      cache.adLibrary,
      cache.episodeVideos,
      episodeId,
      handleFailure,
      pollStatus,
      queryClient,
      queryKey,
      setError,
      setProgress,
    ]
  )

  const addEpisodeVideo = useCallback(
    async (file: File) => {
      await uploadFile("episode", file)
    },
    [uploadFile]
  )

  const uploadAds = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        uploadFile("ad", file)
      }
    },
    [uploadFile]
  )

  const selectEpisodeVideo = useCallback(
    async (episodeVideoAssetId: string) => {
      const episodeVideoAsset = await setCurrentEpisodeVideoAction(
        episodeVideoAssetId
      )

      cache.episodeVideos.save(episodeVideoAsset)
      cache.mainVideo.save(episodeVideoAsset.mediaAsset)
      await queryClient.invalidateQueries({ queryKey })
    },
    [cache.episodeVideos, cache.mainVideo, queryClient, queryKey]
  )

  const removeEpisodeVideo = useCallback(
    async (episodeVideoAssetId: string) => {
      const result = await removeEpisodeVideoAction(episodeVideoAssetId)

      clearPolling(result.mediaAssetId)
      setProgress(result.mediaAssetId, undefined)
      setError("episode", undefined)
      cache.episodeVideos.remove(result.episodeVideoAssetId)
      await queryClient.invalidateQueries({ queryKey })
    },
    [
      cache.episodeVideos,
      clearPolling,
      queryClient,
      queryKey,
      setError,
      setProgress,
    ]
  )

  const resetDemo = useCallback(async () => {
    setIsResettingDemo(true)

    try {
      const mediaAssetIds =
        episodeVideoAssets?.map(
          (episodeVideoAsset) => episodeVideoAsset.mediaAsset.id
        ) ?? []

      await resetDemoEpisodeAction(episodeId)

      for (const mediaAssetId of mediaAssetIds) {
        clearPolling(mediaAssetId)
        setProgress(mediaAssetId, undefined)
      }

      setError("episode", undefined)
      await queryClient.invalidateQueries({ queryKey })
    } finally {
      setIsResettingDemo(false)
    }
  }, [
    clearPolling,
    episodeId,
    episodeVideoAssets,
    queryClient,
    queryKey,
    setError,
    setProgress,
  ])

  return {
    uploadProgressByMediaAssetId,
    uploadErrorByTarget,
    isResettingDemo,
    addEpisodeVideo,
    uploadAds,
    selectEpisodeVideo,
    removeEpisodeVideo,
    resetDemo,
  }
}
