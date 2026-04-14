import "server-only"

import { and, asc, eq, inArray } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"

import { db } from "@/db"
import {
  adAssets,
  adBreakVariants,
  adBreaks,
  episodes,
  mediaAssets,
  playbackBreakResolutions,
  playbackEvents,
  playbackSessions,
} from "@/db/schema"
import { serverEnv } from "@/env/server"

import {
  getMarkerPlaybackReadiness,
  resolveMarkerVariant,
} from "./playback-runtime"

import type { PlaybackMarker } from "./playback-runtime"
import type {
  HlsPlan,
  PlaybackEventInput,
  PlaybackSession,
  PlaybackSessionStart,
  ResolvedPlaybackBreak,
} from "./types"

export type StartPlaybackSessionInput = {
  episodeId: string
  playbackSessionId?: string
  playheadTimeMs?: number
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

const runBatchQueries = async (queries: BatchItem<"pg">[]) => {
  if (queries.length === 0) {
    return
  }

  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]])
}

const loadEpisodeDurationMs = async (episodeId: string) => {
  const [episode] = await db
    .select({
      id: episodes.id,
      durationMs: episodes.durationMs,
      mainMediaDurationMs: mediaAssets.durationMs,
    })
    .from(episodes)
    .leftJoin(mediaAssets, eq(episodes.mainMediaAssetId, mediaAssets.id))
    .where(eq(episodes.id, episodeId))
    .limit(1)

  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`)
  }

  return episode.durationMs ?? episode.mainMediaDurationMs ?? undefined
}

const loadPlaybackMarkers = async (
  episodeId: string
): Promise<PlaybackMarker[]> => {
  const markerRows = await db
    .select({
      id: adBreaks.id,
      requestedTimeMs: adBreaks.requestedTimeMs,
      selectionMode: adBreaks.selectionMode,
      status: adBreaks.status,
    })
    .from(adBreaks)
    .where(eq(adBreaks.episodeId, episodeId))
    .orderBy(asc(adBreaks.requestedTimeMs))

  const markerIds = markerRows.map((marker) => marker.id)

  if (markerIds.length === 0) {
    return markerRows.map((marker) => ({
      ...marker,
      variants: [],
    }))
  }

  const variantRows = await db
    .select({
      id: adBreakVariants.id,
      adBreakId: adBreakVariants.adBreakId,
      status: adBreakVariants.status,
      weight: adBreakVariants.weight,
      isControl: adBreakVariants.isControl,
      mediaStatus: mediaAssets.status,
    })
    .from(adBreakVariants)
    .innerJoin(adAssets, eq(adBreakVariants.adAssetId, adAssets.id))
    .innerJoin(mediaAssets, eq(adAssets.mediaAssetId, mediaAssets.id))
    .where(inArray(adBreakVariants.adBreakId, markerIds))
    .orderBy(asc(adBreakVariants.ordinal))

  const variantsByMarkerId = new Map<string, typeof variantRows>()

  for (const variant of variantRows) {
    const variants = variantsByMarkerId.get(variant.adBreakId) ?? []

    variants.push(variant)
    variantsByMarkerId.set(variant.adBreakId, variants)
  }

  return markerRows.map((marker) => ({
    ...marker,
    variants: (variantsByMarkerId.get(marker.id) ?? []).map((variant) => ({
      id: variant.id,
      status: variant.status,
      weight: variant.weight ?? undefined,
      isControl: variant.isControl ?? undefined,
      mediaStatus: variant.mediaStatus,
    })),
  }))
}

const loadActivePlaybackSession = async ({
  episodeId,
  playbackSessionId,
}: {
  episodeId: string
  playbackSessionId?: string
}): Promise<PlaybackSession | undefined> => {
  if (!playbackSessionId) {
    return undefined
  }

  const [session] = await db
    .select({
      id: playbackSessions.id,
      status: playbackSessions.status,
      startedAt: playbackSessions.startedAt,
    })
    .from(playbackSessions)
    .where(
      and(
        eq(playbackSessions.id, playbackSessionId),
        eq(playbackSessions.episodeId, episodeId),
        eq(playbackSessions.status, "active")
      )
    )
    .limit(1)

  if (!session) {
    return undefined
  }

  return {
    id: session.id,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
  }
}

const createPlaybackSession = async ({
  episodeId,
  playheadTimeMs,
}: {
  episodeId: string
  playheadTimeMs?: number
}): Promise<PlaybackSession> => {
  const sessionId = crypto.randomUUID()
  const startedAt = new Date()

  await runBatchQueries([
    db.insert(playbackSessions).values({
      id: sessionId,
      episodeId,
      mode: "editor_preview",
      status: "active",
      startedAt,
    }),
    db.insert(playbackEvents).values({
      playbackSessionId: sessionId,
      eventType: "session_started",
      playheadTimeMs,
    }),
  ])

  return {
    id: sessionId,
    status: "active",
    startedAt: startedAt.toISOString(),
  }
}

const loadResolvedBreakIdsForSession = async (playbackSessionId: string) => {
  const rows = await db
    .select({
      adBreakId: playbackBreakResolutions.adBreakId,
    })
    .from(playbackBreakResolutions)
    .where(eq(playbackBreakResolutions.playbackSessionId, playbackSessionId))

  return new Set(rows.map((row) => row.adBreakId))
}

const loadResolvedPlaybackBreaks = async (
  playbackSessionId: string
): Promise<ResolvedPlaybackBreak[]> => {
  const rows = await db
    .select({
      adBreakId: playbackBreakResolutions.adBreakId,
      requestedTimeMs: adBreaks.requestedTimeMs,
      selectedVariantId: adBreakVariants.id,
      adAssetId: adAssets.id,
      adAssetTitle: adAssets.title,
      mediaAssetId: mediaAssets.id,
      mediaStreamVideoId: mediaAssets.streamVideoId,
      mediaStatus: mediaAssets.status,
      mediaDurationMs: mediaAssets.durationMs,
      mediaPlaybackUrl: mediaAssets.playbackUrl,
      mediaThumbnailUrl: mediaAssets.thumbnailUrl,
    })
    .from(playbackBreakResolutions)
    .innerJoin(adBreaks, eq(playbackBreakResolutions.adBreakId, adBreaks.id))
    .innerJoin(
      adBreakVariants,
      eq(playbackBreakResolutions.selectedVariantId, adBreakVariants.id)
    )
    .innerJoin(adAssets, eq(adBreakVariants.adAssetId, adAssets.id))
    .innerJoin(mediaAssets, eq(adAssets.mediaAssetId, mediaAssets.id))
    .where(eq(playbackBreakResolutions.playbackSessionId, playbackSessionId))
    .orderBy(asc(adBreaks.requestedTimeMs))

  return rows.map((row) => ({
    adBreakId: row.adBreakId,
    requestedTimeMs: row.requestedTimeMs,
    selectedVariant: {
      id: row.selectedVariantId,
      adAssetId: row.adAssetId,
      adAssetTitle: row.adAssetTitle,
      mediaAsset: {
        id: row.mediaAssetId,
        streamVideoId: row.mediaStreamVideoId,
        status: row.mediaStatus,
        durationMs: row.mediaDurationMs ?? undefined,
        playbackUrl:
          row.mediaPlaybackUrl ??
          buildStreamPlaybackUrl(row.mediaStreamVideoId),
        thumbnailUrl: row.mediaThumbnailUrl ?? undefined,
      },
    },
  }))
}

const createBreakResolutionRows = ({
  episodeDurationMs,
  markers,
  playbackSession,
  resolvedBreakIds,
}: {
  episodeDurationMs?: number
  markers: PlaybackMarker[]
  playbackSession: PlaybackSession
  resolvedBreakIds: Set<string>
}) => {
  return markers
    .filter((marker) => !resolvedBreakIds.has(marker.id))
    .flatMap((marker) => {
      const playbackReadiness = getMarkerPlaybackReadiness({
        episodeDurationMs,
        marker,
      })

      if (!playbackReadiness.canPlay) {
        return []
      }

      const selectedVariant = resolveMarkerVariant(marker)

      if (!selectedVariant) {
        return []
      }

      return [
        {
          id: crypto.randomUUID(),
          playbackSessionId: playbackSession.id,
          adBreakId: marker.id,
          selectedVariantId: selectedVariant.id,
          selectionMode: marker.selectionMode,
        },
      ]
    })
}

const resolveSessionBreaks = async ({
  playbackSession,
  episodeDurationMs,
  markers,
}: {
  playbackSession: PlaybackSession
  episodeDurationMs?: number
  markers: PlaybackMarker[]
}) => {
  const resolvedBreakIds = await loadResolvedBreakIdsForSession(playbackSession.id)
  const newResolutions = createBreakResolutionRows({
    episodeDurationMs,
    markers,
    playbackSession,
    resolvedBreakIds,
  })

  if (newResolutions.length === 0) {
    return
  }

  await runBatchQueries([
    db.insert(playbackBreakResolutions).values(newResolutions),
    db.insert(playbackEvents).values(
      newResolutions.map((resolution) => ({
        playbackSessionId: playbackSession.id,
        adBreakId: resolution.adBreakId,
        selectedVariantId: resolution.selectedVariantId,
        eventType: "break_resolved" as const,
      }))
    ),
  ])
}

export const startPlaybackSession = async ({
  episodeId,
  playbackSessionId,
  playheadTimeMs,
}: StartPlaybackSessionInput): Promise<PlaybackSessionStart> => {
  const episodeDurationMs = await loadEpisodeDurationMs(episodeId)
  let playbackSession = await loadActivePlaybackSession({
    episodeId,
    playbackSessionId,
  })

  if (!playbackSession) {
    playbackSession = await createPlaybackSession({
      episodeId,
      playheadTimeMs,
    })
  }

  const playbackMarkers = await loadPlaybackMarkers(episodeId)

  await resolveSessionBreaks({
    playbackSession,
    episodeDurationMs,
    markers: playbackMarkers,
  })

  return {
    session: playbackSession,
    resolvedBreaks: await loadResolvedPlaybackBreaks(playbackSession.id),
  }
}

export const invalidatePlaybackSessions = async (episodeId: string) => {
  await db
    .update(playbackSessions)
    .set({
      status: "ended",
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(playbackSessions.episodeId, episodeId),
        eq(playbackSessions.status, "active")
      )
    )
}

export const recordPlaybackEvent = async ({
  playbackSessionId,
  adBreakId,
  selectedVariantId,
  eventType,
  playheadTimeMs,
  metadataJson,
}: PlaybackEventInput) => {
  const [matchingResolution] = await db
    .select({
      playbackSessionId: playbackBreakResolutions.playbackSessionId,
    })
    .from(playbackBreakResolutions)
    .innerJoin(
      playbackSessions,
      eq(playbackBreakResolutions.playbackSessionId, playbackSessions.id)
    )
    .where(
      and(
        eq(playbackBreakResolutions.playbackSessionId, playbackSessionId),
        eq(playbackBreakResolutions.adBreakId, adBreakId),
        eq(playbackBreakResolutions.selectedVariantId, selectedVariantId),
        eq(playbackSessions.status, "active")
      )
    )
    .limit(1)

  if (!matchingResolution) {
    throw new Error("Playback event does not match the active session plan")
  }

  await db.insert(playbackEvents).values({
    playbackSessionId,
    adBreakId,
    selectedVariantId,
    eventType,
    playheadTimeMs,
    metadataJson,
  })
}

export const getHlsPlan = async (
  playbackSessionId: string
): Promise<HlsPlan> => {
  const [session] = await db
    .select({
      episodeId: episodes.id,
      episodeDurationMs: episodes.durationMs,
      mainMediaAssetId: mediaAssets.id,
      mainMediaStreamVideoId: mediaAssets.streamVideoId,
      mainMediaPlaybackUrl: mediaAssets.playbackUrl,
      mainMediaDurationMs: mediaAssets.durationMs,
    })
    .from(playbackSessions)
    .innerJoin(episodes, eq(playbackSessions.episodeId, episodes.id))
    .leftJoin(mediaAssets, eq(episodes.mainMediaAssetId, mediaAssets.id))
    .where(eq(playbackSessions.id, playbackSessionId))
    .limit(1)

  if (!session) {
    throw new Error(`Playback session not found: ${playbackSessionId}`)
  }

  if (!session.mainMediaAssetId || !session.mainMediaStreamVideoId) {
    throw new Error("Episode main media is not available for HLS output")
  }

  const episodePlaybackUrl =
    session.mainMediaPlaybackUrl ??
    buildStreamPlaybackUrl(session.mainMediaStreamVideoId)

  if (!episodePlaybackUrl) {
    throw new Error("Episode HLS playback URL is not available")
  }

  const resolvedBreaks = await loadResolvedPlaybackBreaks(playbackSessionId)

  return {
    playbackSessionId,
    episode: {
      id: session.episodeId,
      durationMs: session.episodeDurationMs ?? session.mainMediaDurationMs ?? undefined,
      playbackUrl: episodePlaybackUrl,
    },
    resolvedBreaks: resolvedBreaks.map((playbackBreak) => {
      const adPlaybackUrl = playbackBreak.selectedVariant.mediaAsset.playbackUrl

      if (!adPlaybackUrl) {
        throw new Error(
          `Ad playback URL is not available for break ${playbackBreak.adBreakId}`
        )
      }

      return {
        adBreakId: playbackBreak.adBreakId,
        requestedTimeMs: playbackBreak.requestedTimeMs,
        selectedVariant: {
          id: playbackBreak.selectedVariant.id,
          adAssetId: playbackBreak.selectedVariant.adAssetId,
          adAssetTitle: playbackBreak.selectedVariant.adAssetTitle,
          mediaAsset: {
            id: playbackBreak.selectedVariant.mediaAsset.id,
            playbackUrl: adPlaybackUrl,
            durationMs: playbackBreak.selectedVariant.mediaAsset.durationMs,
          },
        },
      }
    }),
  }
}
