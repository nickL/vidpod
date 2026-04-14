import "server-only"

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm"

import { db } from "@/db"
import {
  adAssets,
  adBreakVariants,
  adBreaks,
  episodes,
  episodeVideoAssets,
  mediaAssets,
  mediaWaveforms,
  shows,
} from "@/db/schema"
import { serverEnv } from "@/env/server"

import { demoEpisodeMediaAssetId, isDemoEpisode } from "./demo"
import { getMarkerPlaybackReadiness } from "./playback-runtime"
import { ensureWaveformRequested } from "./waveform-jobs"

import type { EditorData } from "./types"

const toIsoString = (value: Date | null) => {
  return value ? value.toISOString() : undefined
}

const buildStreamPlaybackUrl = (streamVideoId: string) => {
  const streamCustomerSubdomain = serverEnv.cloudflareStreamCustomerSubdomain

  if (!streamCustomerSubdomain) {
    return undefined
  }

  const hostname = streamCustomerSubdomain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")

  return `https://${hostname}/${streamVideoId}/manifest/video.m3u8`
}

const getDefaultThumbnailTimeSec = (durationMs?: number | null) => {
  if (!durationMs || durationMs <= 1_000) {
    return 1
  }

  return Math.min(5, Math.max(1, Math.round(durationMs / 2_000)))
}

const buildStreamThumbnailUrl = (
  streamVideoId: string,
  durationMs?: number | null
) => {
  const streamCustomerSubdomain = serverEnv.cloudflareStreamCustomerSubdomain

  if (!streamCustomerSubdomain) {
    return undefined
  }

  const hostname = streamCustomerSubdomain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")

  return `https://${hostname}/${streamVideoId}/thumbnails/thumbnail.jpg?time=${getDefaultThumbnailTimeSec(durationMs)}s&height=270`
}

const getThumbnailUrl = ({
  streamVideoId,
  thumbnailUrl,
  durationMs,
}: {
  streamVideoId: string
  thumbnailUrl?: string | null
  durationMs?: number | null
}) => {
  if (!thumbnailUrl) {
    return buildStreamThumbnailUrl(streamVideoId, durationMs)
  }

  if (thumbnailUrl.includes("time=")) {
    return thumbnailUrl
  }

  return buildStreamThumbnailUrl(streamVideoId, durationMs) ?? thumbnailUrl
}

const toEditorMarkerVariants = (
  variants: Array<{
    id: string
    adAssetId: string
    adAssetTitle: string
    mediaStreamVideoId: string
    mediaThumbnailUrl: string | null
    mediaDurationMs: number | null
    ordinal: number
    status: "active" | "paused"
    weight: number | null
    isControl: boolean | null
  }>
) => {
  return variants.map((variant) => ({
    id: variant.id,
    adAssetId: variant.adAssetId,
    adAssetTitle: variant.adAssetTitle,
    thumbnailUrl: getThumbnailUrl({
      streamVideoId: variant.mediaStreamVideoId,
      thumbnailUrl: variant.mediaThumbnailUrl,
      durationMs: variant.mediaDurationMs,
    }),
    ordinal: variant.ordinal,
    status: variant.status,
    weight: variant.weight ?? undefined,
    isControl: variant.isControl ?? undefined,
  }))
}

export const getDefaultEpisodeId = async () => {
  const [episode] = await db
    .select({
      id: episodes.id,
    })
    .from(episodes)
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .where(and(isNull(episodes.archivedAt), isNull(shows.archivedAt)))
    .orderBy(asc(episodes.createdAt))
    .limit(1)

  return episode?.id
}

export const getEpisodeEditor = async (
  episodeId: string
): Promise<EditorData> => {
  const [episode] = await db
    .select({
      showId: shows.id,
      showTitle: shows.title,
      episodeId: episodes.id,
      episodeTitle: episodes.title,
      displayEpisodeNumber: episodes.displayEpisodeNumber,
      publishedAt: episodes.publishedAt,
      episodeDurationMs: episodes.durationMs,
      mainMediaAssetId: mediaAssets.id,
      mainMediaStreamVideoId: mediaAssets.streamVideoId,
      mainMediaStatus: mediaAssets.status,
      mainMediaDurationMs: mediaAssets.durationMs,
      mainMediaPlaybackUrl: mediaAssets.playbackUrl,
      mainMediaThumbnailUrl: mediaAssets.thumbnailUrl,
      mainMediaWaveformStatus: mediaWaveforms.status,
      mainMediaWaveformPeaks: mediaWaveforms.peaks,
      mainMediaWaveformBucketCount: mediaWaveforms.bucketCount,
      mainMediaWaveformLastError: mediaWaveforms.lastError,
    })
    .from(episodes)
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .leftJoin(mediaAssets, eq(episodes.mainMediaAssetId, mediaAssets.id))
    .leftJoin(mediaWaveforms, eq(mediaAssets.id, mediaWaveforms.mediaAssetId))
    .where(
      and(
        eq(episodes.id, episodeId),
        isNull(episodes.archivedAt),
        isNull(shows.archivedAt)
      )
    )
    .limit(1)

  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`)
  }

  const markerRows = await db
    .select({
      id: adBreaks.id,
      requestedTimeMs: adBreaks.requestedTimeMs,
      selectionMode: adBreaks.selectionMode,
      status: adBreaks.status,
      label: adBreaks.label,
    })
    .from(adBreaks)
    .where(eq(adBreaks.episodeId, episodeId))
    .orderBy(asc(adBreaks.requestedTimeMs))

  const markerIds = markerRows.map((row) => row.id)
  const markerVariantRows =
    markerIds.length === 0
      ? []
      : await db
          .select({
            id: adBreakVariants.id,
            adBreakId: adBreakVariants.adBreakId,
            adAssetId: adBreakVariants.adAssetId,
            adAssetTitle: adAssets.title,
            mediaStreamVideoId: mediaAssets.streamVideoId,
            mediaThumbnailUrl: mediaAssets.thumbnailUrl,
            mediaDurationMs: mediaAssets.durationMs,
            mediaStatus: mediaAssets.status,
            ordinal: adBreakVariants.ordinal,
            weight: adBreakVariants.weight,
            isControl: adBreakVariants.isControl,
            status: adBreakVariants.status,
          })
          .from(adBreakVariants)
          .innerJoin(adAssets, eq(adBreakVariants.adAssetId, adAssets.id))
          .innerJoin(mediaAssets, eq(adAssets.mediaAssetId, mediaAssets.id))
          .where(inArray(adBreakVariants.adBreakId, markerIds))
          .orderBy(asc(adBreakVariants.ordinal))

  const markerVariantsByBreakId = new Map<string, typeof markerVariantRows>()

  for (const variantRow of markerVariantRows) {
    const variants = markerVariantsByBreakId.get(variantRow.adBreakId) ?? []
    variants.push(variantRow)
    markerVariantsByBreakId.set(variantRow.adBreakId, variants)
  }

  const adLibraryRows = await db
    .select({
      id: adAssets.id,
      title: adAssets.title,
      status: adAssets.status,
      createdAt: adAssets.createdAt,
      mediaAssetId: mediaAssets.id,
      mediaStreamVideoId: mediaAssets.streamVideoId,
      mediaStatus: mediaAssets.status,
      mediaDurationMs: mediaAssets.durationMs,
      mediaThumbnailUrl: mediaAssets.thumbnailUrl,
    })
    .from(adAssets)
    .innerJoin(mediaAssets, eq(adAssets.mediaAssetId, mediaAssets.id))
    .where(eq(adAssets.showId, episode.showId))
    .orderBy(asc(adAssets.createdAt))

  const episodeVideoRows = await db
    .select({
      id: episodeVideoAssets.id,
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
    .where(eq(episodeVideoAssets.episodeId, episodeId))
    .orderBy(desc(episodeVideoAssets.createdAt))

  const canResetDemo =
    isDemoEpisode(episodeId) &&
    (episode.mainMediaAssetId !== demoEpisodeMediaAssetId ||
      episodeVideoRows.length > 0)

  const episodeDurationMs =
    episode.episodeDurationMs ?? episode.mainMediaDurationMs ?? undefined
  const mainMediaWaveform = episode.mainMediaAssetId
    ? await ensureWaveformRequested({
        mediaAssetId: episode.mainMediaAssetId,
        sourceUrl:
          episode.mainMediaPlaybackUrl ??
          buildStreamPlaybackUrl(episode.mainMediaStreamVideoId!),
        waveform: episode.mainMediaWaveformStatus
          ? {
              status: episode.mainMediaWaveformStatus,
              peaks: episode.mainMediaWaveformPeaks ?? undefined,
              bucketCount: episode.mainMediaWaveformBucketCount ?? undefined,
              lastError: episode.mainMediaWaveformLastError ?? undefined,
            }
          : undefined,
      })
    : undefined

  return {
    show: {
      id: episode.showId,
      title: episode.showTitle,
    },
    episode: {
      id: episode.episodeId,
      title: episode.episodeTitle,
      displayEpisodeNumber: episode.displayEpisodeNumber ?? undefined,
      publishedAt: toIsoString(episode.publishedAt),
      durationMs: episode.episodeDurationMs ?? undefined,
    },
    markers: markerRows.map((row) => {
      const markerVariants = markerVariantsByBreakId.get(row.id) ?? []
      const variants = toEditorMarkerVariants(markerVariants)
      const playbackReadiness = getMarkerPlaybackReadiness({
        episodeDurationMs,
        marker: {
          id: row.id,
          requestedTimeMs: row.requestedTimeMs,
          selectionMode: row.selectionMode,
          status: row.status,
          variants: markerVariants.map((variant) => ({
            id: variant.id,
            adAssetId: variant.adAssetId,
            status: variant.status,
            weight: variant.weight ?? undefined,
            isControl: variant.isControl ?? undefined,
            mediaStatus: variant.mediaStatus,
          })),
        },
      })

      return {
        id: row.id,
        requestedTimeMs: row.requestedTimeMs,
        selectionMode: row.selectionMode,
        status: row.status,
        label: row.label ?? undefined,
        variants,
        playbackReadiness,
      }
    }),
    mainMediaAsset: episode.mainMediaAssetId
      ? {
          id: episode.mainMediaAssetId,
          streamVideoId: episode.mainMediaStreamVideoId!,
          status: episode.mainMediaStatus!,
          durationMs: episode.mainMediaDurationMs ?? undefined,
          playbackUrl:
            episode.mainMediaPlaybackUrl ??
            buildStreamPlaybackUrl(episode.mainMediaStreamVideoId!),
          thumbnailUrl: getThumbnailUrl({
            streamVideoId: episode.mainMediaStreamVideoId!,
            thumbnailUrl: episode.mainMediaThumbnailUrl,
            durationMs: episode.mainMediaDurationMs,
          }),
          waveform: mainMediaWaveform,
        }
      : undefined,
    adLibrary: adLibraryRows.map((ad) => ({
      id: ad.id,
      title: ad.title,
      status: ad.status,
      createdAt: ad.createdAt.toISOString(),
      mediaAsset: {
        id: ad.mediaAssetId,
        streamVideoId: ad.mediaStreamVideoId,
        status: ad.mediaStatus,
        durationMs: ad.mediaDurationMs ?? undefined,
        thumbnailUrl: getThumbnailUrl({
          streamVideoId: ad.mediaStreamVideoId,
          thumbnailUrl: ad.mediaThumbnailUrl,
          durationMs: ad.mediaDurationMs,
        }),
      },
    })),
    episodeVideoAssets: episodeVideoRows.map((video) => ({
      id: video.id,
      title: video.title,
      createdAt: video.createdAt.toISOString(),
      mediaAsset: {
        id: video.mediaAssetId,
        streamVideoId: video.mediaStreamVideoId,
        status: video.mediaStatus,
        durationMs: video.mediaDurationMs ?? undefined,
        playbackUrl:
          video.mediaPlaybackUrl ??
          buildStreamPlaybackUrl(video.mediaStreamVideoId),
        thumbnailUrl: getThumbnailUrl({
          streamVideoId: video.mediaStreamVideoId,
          thumbnailUrl: video.mediaThumbnailUrl,
          durationMs: video.mediaDurationMs,
        }),
      },
    })),
    canResetDemo,
  }
}
