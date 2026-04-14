import "server-only"

import { and, eq, inArray, ne } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"

import { db } from "@/db"
import {
  adAssets,
  episodes,
  episodeVideoAssets,
  mediaAssets,
} from "@/db/schema"
import { serverEnv } from "@/env/server"

import { demoEpisodeMediaAssetId, isDemoEpisode } from "../demo"
import { endActivePlaybackSessions } from "../playback/playback-sessions"

import type {
  AdLibraryItem,
  EpisodeVideoAsset,
  MediaAsset,
  UploadInitInput,
  UploadInitResult,
  UploadTarget,
} from "../types"

type CloudflareVideoDetails = {
  uid: string
  readyToStream: boolean
  duration?: number
  thumbnail?: string
  preview?: string
  status?: {
    state?: string
  }
}

type CloudflareErrorPayload = {
  errors?: Array<{ code?: number; message?: string }>
  messages?: Array<{ code?: number; message?: string }>
}

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
const THUMBNAIL_HEIGHT_PX = 270

const normalizeStreamHostname = (configuredSubdomain: string) => {
  return configuredSubdomain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
}

const runBatchQueries = async (queries: BatchItem<"pg">[]) => {
  if (queries.length === 0) {
    return
  }

  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]])
}

const getUploadTitle = (filename: string) => {
  const title = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()

  return title || filename
}

const buildStreamPlaybackUrl = (
  streamVideoId: string,
  referenceUrl?: string | null
) => {
  const configuredSubdomain = serverEnv.cloudflareStreamCustomerSubdomain

  if (configuredSubdomain) {
    return `https://${normalizeStreamHostname(configuredSubdomain)}/${streamVideoId}/manifest/video.m3u8`
  }

  if (!referenceUrl) {
    return undefined
  }

  const hostname = new URL(referenceUrl).host

  return `https://${hostname}/${streamVideoId}/manifest/video.m3u8`
}

const getDefaultThumbnailTimeSec = (durationSeconds?: number) => {
  if (!durationSeconds || durationSeconds <= 1) {
    return 1
  }

  return Math.min(5, Math.max(1, Math.round(durationSeconds / 2)))
}

const buildThumbnailUrl = ({
  streamVideoId,
  durationSeconds,
  referenceUrl,
}: {
  streamVideoId: string
  durationSeconds?: number
  referenceUrl?: string | null
}) => {
  const configuredSubdomain = serverEnv.cloudflareStreamCustomerSubdomain

  if (configuredSubdomain) {
    return `https://${normalizeStreamHostname(configuredSubdomain)}/${streamVideoId}/thumbnails/thumbnail.jpg?time=${getDefaultThumbnailTimeSec(durationSeconds)}s&height=${THUMBNAIL_HEIGHT_PX}`
  }

  if (!referenceUrl) {
    return undefined
  }

  const reference = new URL(referenceUrl)

  reference.searchParams.set(
    "time",
    `${getDefaultThumbnailTimeSec(durationSeconds)}s`
  )
  reference.searchParams.set("height", `${THUMBNAIL_HEIGHT_PX}`)

  return reference.toString()
}

const getCloudflareHeaders = () => {
  return {
    Authorization: `Bearer ${serverEnv.cloudflareStreamApiToken}`,
  }
}

const getCloudflareErrorMessage = async (response: Response) => {
  let payload: CloudflareErrorPayload | undefined

  try {
    payload = (await response.json()) as CloudflareErrorPayload
  } catch {
    payload = undefined
  }

  const providerMessage =
    payload?.errors?.[0]?.message ?? payload?.messages?.[0]?.message

  if (
    payload?.errors?.[0]?.code === 10011 ||
    providerMessage?.toLowerCase().includes("storage quota exceeded")
  ) {
    return "Cloudflare Stream storage quota exceeded. Delete unused videos or add more minutes before uploading again."
  }

  return providerMessage ?? `Cloudflare upload failed with ${response.status}.`
}

const deleteCloudflareVideo = async (streamVideoId: string) => {
  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/accounts/${serverEnv.cloudflareAccountId}/stream/${streamVideoId}`,
    {
      method: "DELETE",
      headers: getCloudflareHeaders(),
    }
  )

  if (response.ok || response.status === 404) {
    return
  }

  throw new Error(await getCloudflareErrorMessage(response))
}

const createUploadSession = async ({
  filename,
  fileSize,
}: {
  filename: string
  fileSize: number
}) => {
  const metadata = [
    ["name", filename],
    ["filename", filename],
  ]
    .map(([key, value]) => `${key} ${Buffer.from(value).toString("base64")}`)
    .join(",")

  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/accounts/${serverEnv.cloudflareAccountId}/stream?direct_user=true`,
    {
      method: "POST",
      headers: {
        ...getCloudflareHeaders(),
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(fileSize),
        "Upload-Metadata": metadata,
      },
    }
  )

  if (!response.ok) {
    throw new Error(await getCloudflareErrorMessage(response))
  }

  const uploadUrl = response.headers.get("location")
  const streamVideoId = response.headers.get("stream-media-id")

  if (!uploadUrl || !streamVideoId) {
    throw new Error("Cloudflare upload did not return a usable upload session")
  }

  return {
    uploadUrl,
    streamVideoId,
  }
}

const loadEpisode = async (episodeId: string) => {
  const [episode] = await db
    .select({
      id: episodes.id,
      showId: episodes.showId,
      mainMediaAssetId: episodes.mainMediaAssetId,
    })
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1)

  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`)
  }

  return episode
}

const loadMediaAsset = async (mediaAssetId: string) => {
  const [mediaAsset] = await db
    .select({
      id: mediaAssets.id,
      durationMs: mediaAssets.durationMs,
      status: mediaAssets.status,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaAssetId))
    .limit(1)

  if (!mediaAsset) {
    throw new Error(`Media asset not found: ${mediaAssetId}`)
  }

  return mediaAsset
}

const hasInFlightEpisodeVideo = async (episodeId: string) => {
  const [row] = await db
    .select({ id: episodeVideoAssets.id })
    .from(episodeVideoAssets)
    .innerJoin(mediaAssets, eq(episodeVideoAssets.mediaAssetId, mediaAssets.id))
    .where(
      and(
        eq(episodeVideoAssets.episodeId, episodeId),
        inArray(mediaAssets.status, ["uploading", "processing"])
      )
    )
    .limit(1)

  return Boolean(row)
}

const removeOtherEpisodeVideos = async ({
  episodeId,
  keepEpisodeVideoAssetId,
  keepMediaAssetId,
}: {
  episodeId: string
  keepEpisodeVideoAssetId?: string
  keepMediaAssetId?: string
}) => {
  const conditions = [eq(episodeVideoAssets.episodeId, episodeId)]

  if (keepEpisodeVideoAssetId) {
    conditions.push(ne(episodeVideoAssets.id, keepEpisodeVideoAssetId))
  }

  if (keepMediaAssetId) {
    conditions.push(ne(episodeVideoAssets.mediaAssetId, keepMediaAssetId))
  }

  const rows = await db
    .select({
      id: episodeVideoAssets.id,
      mediaAssetId: episodeVideoAssets.mediaAssetId,
      streamVideoId: mediaAssets.streamVideoId,
    })
    .from(episodeVideoAssets)
    .innerJoin(mediaAssets, eq(episodeVideoAssets.mediaAssetId, mediaAssets.id))
    .where(and(...conditions))

  if (rows.length === 0) {
    return
  }

  for (const row of rows) {
    await deleteCloudflareVideo(row.streamVideoId)
  }

  const episodeVideoAssetIds = rows.map((row) => row.id)
  const mediaAssetIds = rows.map((row) => row.mediaAssetId)

  await runBatchQueries([
    db
      .delete(episodeVideoAssets)
      .where(inArray(episodeVideoAssets.id, episodeVideoAssetIds)),
    db
      .delete(mediaAssets)
      .where(inArray(mediaAssets.id, mediaAssetIds)),
  ])
}

const toMediaAsset = ({
  id,
  streamVideoId,
  status,
  durationMs,
  playbackUrl,
  thumbnailUrl,
}: {
  id: string
  streamVideoId: string
  status: MediaAsset["status"]
  durationMs?: number | null
  playbackUrl?: string | null
  thumbnailUrl?: string | null
}): MediaAsset => ({
  id,
  streamVideoId,
  status,
  durationMs: durationMs ?? undefined,
  playbackUrl: playbackUrl ?? undefined,
  thumbnailUrl: thumbnailUrl ?? undefined,
})

const toEpisodeVideoAsset = ({
  id,
  title,
  createdAt,
  mediaAsset,
}: {
  id: string
  title: string
  createdAt: Date
  mediaAsset: MediaAsset
}): EpisodeVideoAsset => ({
  id,
  title,
  createdAt: createdAt.toISOString(),
  mediaAsset,
})

const toAdLibraryItem = ({
  id,
  title,
  status,
  createdAt,
  mediaAsset,
}: {
  id: string
  title: string
  status: AdLibraryItem["status"]
  createdAt: Date
  mediaAsset: MediaAsset
}): AdLibraryItem => ({
  id,
  title,
  status,
  createdAt: createdAt.toISOString(),
  mediaAsset: {
    id: mediaAsset.id,
    streamVideoId: mediaAsset.streamVideoId,
    status: mediaAsset.status,
    durationMs: mediaAsset.durationMs,
    thumbnailUrl: mediaAsset.thumbnailUrl,
  },
})

const loadCloudflareVideoDetails = async (
  streamVideoId: string
): Promise<CloudflareVideoDetails> => {
  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/accounts/${serverEnv.cloudflareAccountId}/stream/${streamVideoId}`,
    {
      headers: getCloudflareHeaders(),
    }
  )

  const payload = (await response.json()) as {
    success: boolean
    errors?: Array<{ message?: string }>
    result?: CloudflareVideoDetails
  }

  if (!response.ok || !payload.success || !payload.result) {
    throw new Error(
      payload.errors?.[0]?.message ?? "Unable to refresh uploaded media"
    )
  }

  return payload.result
}

const getMediaStatusFromCloudflare = (
  details: CloudflareVideoDetails
): MediaAsset["status"] => {
  if (details.readyToStream || details.status?.state === "ready") {
    return "ready"
  }

  if (details.status?.state === "error") {
    return "failed"
  }

  return "processing"
}

const refreshMediaAsset = async ({
  mediaAssetId,
  streamVideoId,
}: {
  mediaAssetId: string
  streamVideoId: string
}) => {
  const details = await loadCloudflareVideoDetails(streamVideoId)
  const nextStatus = getMediaStatusFromCloudflare(details)

  await db
    .update(mediaAssets)
    .set({
      status: nextStatus,
      durationMs: details.duration
        ? Math.round(details.duration * 1000)
        : null,
      playbackUrl:
        nextStatus === "ready"
          ? buildStreamPlaybackUrl(details.uid, details.thumbnail ?? details.preview)
          : null,
      thumbnailUrl:
        nextStatus === "ready"
          ? buildThumbnailUrl({
              streamVideoId: details.uid,
              durationSeconds: details.duration,
              referenceUrl: details.thumbnail,
            }) ?? null
          : details.thumbnail ?? null,
      updatedAt: new Date(),
    })
    .where(eq(mediaAssets.id, mediaAssetId))
}

const loadEpisodeVideoAsset = async (episodeVideoAssetId: string) => {
  const [row] = await db
    .select({
      id: episodeVideoAssets.id,
      episodeId: episodeVideoAssets.episodeId,
      title: episodeVideoAssets.title,
      createdAt: episodeVideoAssets.createdAt,
      mediaAssetId: mediaAssets.id,
      mediaStreamVideoId: mediaAssets.streamVideoId,
      mediaStatus: mediaAssets.status,
      mediaDurationMs: mediaAssets.durationMs,
      mediaPlaybackUrl: mediaAssets.playbackUrl,
      mediaThumbnailUrl: mediaAssets.thumbnailUrl,
    })
    .from(episodeVideoAssets)
    .innerJoin(mediaAssets, eq(episodeVideoAssets.mediaAssetId, mediaAssets.id))
    .where(eq(episodeVideoAssets.id, episodeVideoAssetId))
    .limit(1)

  if (!row) {
    throw new Error("Episode video not found")
  }

  return {
    episodeId: row.episodeId,
    episodeVideoAsset: toEpisodeVideoAsset({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      mediaAsset: toMediaAsset({
        id: row.mediaAssetId,
        streamVideoId: row.mediaStreamVideoId,
        status: row.mediaStatus,
        durationMs: row.mediaDurationMs,
        playbackUrl: row.mediaPlaybackUrl,
        thumbnailUrl: row.mediaThumbnailUrl,
      }),
    }),
  }
}

const loadAdLibraryItem = async (adAssetId: string) => {
  const [row] = await db
    .select({
      id: adAssets.id,
      title: adAssets.title,
      status: adAssets.status,
      createdAt: adAssets.createdAt,
      mediaAssetId: mediaAssets.id,
      mediaStreamVideoId: mediaAssets.streamVideoId,
      mediaStatus: mediaAssets.status,
      mediaDurationMs: mediaAssets.durationMs,
      mediaPlaybackUrl: mediaAssets.playbackUrl,
      mediaThumbnailUrl: mediaAssets.thumbnailUrl,
    })
    .from(adAssets)
    .innerJoin(mediaAssets, eq(adAssets.mediaAssetId, mediaAssets.id))
    .where(eq(adAssets.id, adAssetId))
    .limit(1)

  if (!row) {
    throw new Error("Ad asset not found")
  }

  return toAdLibraryItem({
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.createdAt,
    mediaAsset: toMediaAsset({
      id: row.mediaAssetId,
      streamVideoId: row.mediaStreamVideoId,
      status: row.mediaStatus,
      durationMs: row.mediaDurationMs,
      playbackUrl: row.mediaPlaybackUrl,
      thumbnailUrl: row.mediaThumbnailUrl,
    }),
  })
}

export const startUpload = async ({
  target,
  episodeId,
  filename,
  fileSize,
}: UploadInitInput): Promise<UploadInitResult> => {
  const episode = await loadEpisode(episodeId)

  if (target === "episode" && (await hasInFlightEpisodeVideo(episodeId))) {
    throw new Error("Finish the current video upload before adding another one.")
  }

  const { uploadUrl, streamVideoId } = await createUploadSession({
    filename,
    fileSize,
  })
  const title = getUploadTitle(filename)
  const mediaAssetId = crypto.randomUUID()
  const createdAt = new Date()

  switch (target) {
    case "episode": {
      const episodeVideoAssetId = crypto.randomUUID()
      await removeOtherEpisodeVideos({
        episodeId,
        keepMediaAssetId: episode.mainMediaAssetId ?? undefined,
      })

      await runBatchQueries([
        db.insert(mediaAssets).values({
          id: mediaAssetId,
          streamVideoId,
          kind: "video",
          status: "uploading",
          createdAt,
          updatedAt: createdAt,
        }),
        db.insert(episodeVideoAssets).values({
          id: episodeVideoAssetId,
          episodeId,
          mediaAssetId,
          title,
          createdAt,
          updatedAt: createdAt,
        }),
      ])

      return {
        target,
        uploadUrl,
        episodeVideoAsset: toEpisodeVideoAsset({
          id: episodeVideoAssetId,
          title,
          createdAt,
          mediaAsset: toMediaAsset({
            id: mediaAssetId,
            streamVideoId,
            status: "uploading",
          }),
        }),
      }
    }
    case "ad": {
      const adAssetId = crypto.randomUUID()

      await runBatchQueries([
        db.insert(mediaAssets).values({
          id: mediaAssetId,
          streamVideoId,
          kind: "video",
          status: "uploading",
          createdAt,
          updatedAt: createdAt,
        }),
        db.insert(adAssets).values({
          id: adAssetId,
          showId: episode.showId,
          mediaAssetId,
          title,
          status: "active",
          createdAt,
          updatedAt: createdAt,
        }),
      ])

      return {
        target,
        uploadUrl,
        adLibraryItem: toAdLibraryItem({
          id: adAssetId,
          title,
          status: "active",
          createdAt,
          mediaAsset: toMediaAsset({
            id: mediaAssetId,
            streamVideoId,
            status: "uploading",
          }),
        }),
      }
    }
  }
}

export const refreshUploadedAsset = async ({
  target,
  assetId,
}: {
  target: UploadTarget
  assetId: string
}) => {
  switch (target) {
    case "episode": {
      const { episodeVideoAsset } = await loadEpisodeVideoAsset(assetId)
      await refreshMediaAsset({
        mediaAssetId: episodeVideoAsset.mediaAsset.id,
        streamVideoId: episodeVideoAsset.mediaAsset.streamVideoId,
      })

      return loadEpisodeVideoAsset(assetId)
    }
    case "ad": {
      const adLibraryItem = await loadAdLibraryItem(assetId)
      await refreshMediaAsset({
        mediaAssetId: adLibraryItem.mediaAsset.id,
        streamVideoId: adLibraryItem.mediaAsset.streamVideoId,
      })

      return loadAdLibraryItem(assetId)
    }
  }
}

export const failUpload = async (mediaAssetId: string) => {
  await db
    .update(mediaAssets)
    .set({
      status: "failed",
      updatedAt: new Date(),
    })
    .where(eq(mediaAssets.id, mediaAssetId))
}

export const removeEpisodeVideo = async (
  episodeVideoAssetId: string
) => {
  const { episodeId, episodeVideoAsset } = await loadEpisodeVideoAsset(
    episodeVideoAssetId
  )
  const episode = await loadEpisode(episodeId)

  if (episode.mainMediaAssetId === episodeVideoAsset.mediaAsset.id) {
    throw new Error("Current episode video cannot be discarded")
  }

  await deleteCloudflareVideo(episodeVideoAsset.mediaAsset.streamVideoId)

  await runBatchQueries([
    db
      .delete(episodeVideoAssets)
      .where(eq(episodeVideoAssets.id, episodeVideoAsset.id)),
    db
      .delete(mediaAssets)
      .where(eq(mediaAssets.id, episodeVideoAsset.mediaAsset.id)),
  ])

  return {
    episodeVideoAssetId: episodeVideoAsset.id,
    mediaAssetId: episodeVideoAsset.mediaAsset.id,
  }
}

export const setCurrentEpisodeVideo = async (episodeVideoAssetId: string) => {
  const { episodeId, episodeVideoAsset } = await loadEpisodeVideoAsset(
    episodeVideoAssetId
  )

  if (episodeVideoAsset.mediaAsset.status !== "ready") {
    throw new Error("Episode video is not ready yet")
  }

  await runBatchQueries([
    db
      .update(episodes)
      .set({
        mainMediaAssetId: episodeVideoAsset.mediaAsset.id,
        durationMs: episodeVideoAsset.mediaAsset.durationMs ?? null,
        updatedAt: new Date(),
      })
      .where(eq(episodes.id, episodeId)),
    db
      .update(mediaAssets)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(mediaAssets.id, episodeVideoAsset.mediaAsset.id)),
  ])

  await endActivePlaybackSessions(episodeId)

  await removeOtherEpisodeVideos({
    episodeId,
    keepEpisodeVideoAssetId: episodeVideoAsset.id,
    keepMediaAssetId: episodeVideoAsset.mediaAsset.id,
  })

  return episodeVideoAsset
}

export const resetDemoEpisode = async (episodeId: string) => {
  if (!isDemoEpisode(episodeId)) {
    throw new Error("Reset demo is only available for the seeded episode")
  }

  const demoMediaAsset = await loadMediaAsset(demoEpisodeMediaAssetId)

  if (demoMediaAsset.status !== "ready") {
    throw new Error("Demo episode video is not ready")
  }

  await runBatchQueries([
    db
      .update(episodes)
      .set({
        mainMediaAssetId: demoMediaAsset.id,
        durationMs: demoMediaAsset.durationMs ?? null,
        updatedAt: new Date(),
      })
      .where(eq(episodes.id, episodeId)),
    db
      .update(mediaAssets)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(mediaAssets.id, demoMediaAsset.id)),
  ])

  await endActivePlaybackSessions(episodeId)
  await removeOtherEpisodeVideos({
    episodeId,
    keepMediaAssetId: demoMediaAsset.id,
  })

  return {
    mediaAssetId: demoMediaAsset.id,
  }
}
