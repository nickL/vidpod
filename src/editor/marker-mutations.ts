import "server-only"

import { and, eq, inArray, ne } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"

import { db } from "@/db"
import { adAssets, adBreaks, adBreakVariants, episodes, mediaAssets } from "@/db/schema"

import type { Marker, MarkerVariant } from "./types"
import { invalidatePlaybackSessions } from "./playback-sessions"
import { getMarkerPlaybackReadiness } from "./playback-runtime"
import { MARKER_DURATION_MS } from "./timeline/shared"

type MarkerSelectionMode = Marker["selectionMode"]
type MarkerStatus = Marker["status"]
type VariantStatus = MarkerVariant["status"]

type VariantInput = {
  adAssetId: string
  weight?: number
  isControl?: boolean
  status?: VariantStatus
}

type EpisodeContext = {
  showId: string
  durationMs?: number
  mainMediaDurationMs?: number
}

export type CreateMarkerInput = {
  episodeId: string
  requestedTimeMs: number
  selectionMode: MarkerSelectionMode
  status?: MarkerStatus
  label?: string
  variants?: VariantInput[]
}

export type UpdateMarkerInput = {
  markerId: string
  requestedTimeMs?: number
  selectionMode?: MarkerSelectionMode
  status?: MarkerStatus
  label?: string
  variants?: VariantInput[]
}

const normalizeLabel = (value?: string) => {
  const trimmedValue = value?.trim()

  return trimmedValue ? trimmedValue : null
}

const toVariantInput = (variant: MarkerVariant): VariantInput => {
  return {
    adAssetId: variant.adAssetId,
    weight: variant.weight,
    isControl: variant.isControl,
    status: variant.status,
  }
}

const buildVariantRows = (
  markerId: string,
  variants: VariantInput[]
) => {
  return variants.map((variant, index) => ({
    id: crypto.randomUUID(),
    adBreakId: markerId,
    adAssetId: variant.adAssetId,
    ordinal: index + 1,
    weight: variant.weight ?? null,
    isControl: variant.isControl ?? null,
    status: variant.status ?? "active",
  }))
}

const validateVariantsForSelectionMode = (
  selectionMode: MarkerSelectionMode,
  variants: VariantInput[]
) => {
  if (selectionMode === "auto" && variants.length < 1) {
    throw new Error("Auto markers require at least one ad variant")
  }

  if (selectionMode === "static" && variants.length !== 1) {
    throw new Error("Static markers require exactly one ad variant")
  }

  if (selectionMode === "ab" && variants.length < 2) {
    throw new Error("A/B markers require at least two ad variants")
  }
}

const getEpisodeContext = async (episodeId: string) => {
  const [episode] = await db
    .select({
      showId: episodes.showId,
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

  return {
    showId: episode.showId,
    durationMs: episode.durationMs ?? undefined,
    mainMediaDurationMs: episode.mainMediaDurationMs ?? undefined,
  }
}

const runBatchQueries = async (queries: BatchItem<"pg">[]) => {
  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]])
}

const validateAdAssetsForShow = async (
  showId: string,
  variants: VariantInput[]
) => {
  if (variants.length === 0) {
    return
  }

  const adAssetIds = Array.from(new Set(variants.map((variant) => variant.adAssetId)))
  const rows = await db
    .select({
      id: adAssets.id,
    })
    .from(adAssets)
    .where(and(eq(adAssets.showId, showId), inArray(adAssets.id, adAssetIds)))

  if (rows.length !== adAssetIds.length) {
    throw new Error("One or more ad assets do not belong to this episode's show")
  }
}

const validateMarkerPlacement = async ({
  episodeId,
  episodeDurationMs,
  requestedTimeMs,
  markerIdToIgnore,
}: {
  episodeId: string
  episodeDurationMs?: number
  requestedTimeMs: number
  markerIdToIgnore?: string
}) => {
  if (requestedTimeMs < 0) {
    throw new Error("Marker time cannot be negative")
  }

  const markerEndMs = requestedTimeMs + MARKER_DURATION_MS

  if (
    episodeDurationMs !== undefined &&
    episodeDurationMs !== null &&
    markerEndMs > episodeDurationMs
  ) {
    throw new Error("Marker must fit within the episode duration")
  }

  const placementRows = await db
    .select({
      id: adBreaks.id,
      requestedTimeMs: adBreaks.requestedTimeMs,
    })
    .from(adBreaks)
    .where(
      markerIdToIgnore
        ? and(
            eq(adBreaks.episodeId, episodeId),
            ne(adBreaks.id, markerIdToIgnore)
          )
        : eq(adBreaks.episodeId, episodeId)
    )

  const overlappingMarker = placementRows.find((row) => {
    const existingMarkerEndMs = row.requestedTimeMs + MARKER_DURATION_MS

    return row.requestedTimeMs < markerEndMs && existingMarkerEndMs > requestedTimeMs
  })

  if (overlappingMarker) {
    throw new Error("Markers cannot overlap")
  }
}

const loadPersistedMarker = async (markerId: string): Promise<Marker> => {
  const [markerRow] = await db
    .select({
      episodeId: adBreaks.episodeId,
      id: adBreaks.id,
      requestedTimeMs: adBreaks.requestedTimeMs,
      selectionMode: adBreaks.selectionMode,
      status: adBreaks.status,
      label: adBreaks.label,
    })
    .from(adBreaks)
    .where(eq(adBreaks.id, markerId))
    .limit(1)

  if (!markerRow) {
    throw new Error(`Marker not found: ${markerId}`)
  }

  const variantRows = await db
    .select({
      id: adBreakVariants.id,
      adAssetId: adBreakVariants.adAssetId,
      adAssetTitle: adAssets.title,
      mediaStatus: mediaAssets.status,
      ordinal: adBreakVariants.ordinal,
      status: adBreakVariants.status,
      weight: adBreakVariants.weight,
      isControl: adBreakVariants.isControl,
    })
    .from(adBreakVariants)
    .innerJoin(adAssets, eq(adBreakVariants.adAssetId, adAssets.id))
    .innerJoin(mediaAssets, eq(adAssets.mediaAssetId, mediaAssets.id))
    .where(eq(adBreakVariants.adBreakId, markerId))
    .orderBy(adBreakVariants.ordinal)

  const episodeContext = await getEpisodeContext(markerRow.episodeId)
  const episodeDurationMs =
    episodeContext.durationMs ?? episodeContext.mainMediaDurationMs ?? undefined
  const variants = variantRows.map((row) => ({
    id: row.id,
    adAssetId: row.adAssetId,
    adAssetTitle: row.adAssetTitle,
    ordinal: row.ordinal,
    status: row.status,
    weight: row.weight ?? undefined,
    isControl: row.isControl ?? undefined,
  }))

  return {
    id: markerRow.id,
    requestedTimeMs: markerRow.requestedTimeMs,
    selectionMode: markerRow.selectionMode,
    status: markerRow.status,
    label: markerRow.label ?? undefined,
    variants,
    playbackReadiness: getMarkerPlaybackReadiness({
      episodeDurationMs,
      marker: {
        id: markerRow.id,
        requestedTimeMs: markerRow.requestedTimeMs,
        selectionMode: markerRow.selectionMode,
        status: markerRow.status,
        variants: variantRows.map((row) => ({
          id: row.id,
          status: row.status,
          weight: row.weight ?? undefined,
          isControl: row.isControl ?? undefined,
          mediaStatus: row.mediaStatus,
        })),
      },
    }),
  }
}

export const createMarker = async (
  input: CreateMarkerInput
) => {
  const markerId = crypto.randomUUID()
  const selectionMode = input.selectionMode
  const variants = input.variants ?? []
  const episodeContext: EpisodeContext = await getEpisodeContext(input.episodeId)

  await validateMarkerPlacement({
    episodeId: input.episodeId,
    episodeDurationMs:
      episodeContext.durationMs ?? episodeContext.mainMediaDurationMs ?? undefined,
    requestedTimeMs: input.requestedTimeMs,
  })
  validateVariantsForSelectionMode(selectionMode, variants)
  await validateAdAssetsForShow(episodeContext.showId, variants)

  const createQueries: BatchItem<"pg">[] = [
    db.insert(adBreaks).values({
      id: markerId,
      episodeId: input.episodeId,
      requestedTimeMs: input.requestedTimeMs,
      selectionMode,
      status: input.status ?? "draft",
      label: normalizeLabel(input.label),
    }),
  ]

  if (variants.length > 0) {
    createQueries.push(
      db.insert(adBreakVariants).values(buildVariantRows(markerId, variants))
    )
  }

  await runBatchQueries(createQueries)
  await invalidatePlaybackSessions(input.episodeId)

  return loadPersistedMarker(markerId)
}

export const updateMarker = async (
  input: UpdateMarkerInput
) => {
  const [currentMarker] = await db
    .select({
      id: adBreaks.id,
      episodeId: adBreaks.episodeId,
      requestedTimeMs: adBreaks.requestedTimeMs,
      selectionMode: adBreaks.selectionMode,
      status: adBreaks.status,
      label: adBreaks.label,
    })
    .from(adBreaks)
    .where(eq(adBreaks.id, input.markerId))
    .limit(1)

  if (!currentMarker) {
    throw new Error(`Marker not found: ${input.markerId}`)
  }

  const persistedMarker = await loadPersistedMarker(input.markerId)
  const selectionMode = input.selectionMode ?? currentMarker.selectionMode
  const requestedTimeMs = input.requestedTimeMs ?? currentMarker.requestedTimeMs
  const variants =
    input.variants ??
    persistedMarker.variants.map((variant) => toVariantInput(variant))
  const episodeContext: EpisodeContext = await getEpisodeContext(currentMarker.episodeId)

  await validateMarkerPlacement({
    episodeId: currentMarker.episodeId,
    episodeDurationMs:
      episodeContext.durationMs ?? episodeContext.mainMediaDurationMs ?? undefined,
    requestedTimeMs,
    markerIdToIgnore: input.markerId,
  })
  validateVariantsForSelectionMode(selectionMode, variants)
  await validateAdAssetsForShow(episodeContext.showId, variants)

  const updateQueries: BatchItem<"pg">[] = [
    db
      .update(adBreaks)
      .set({
        requestedTimeMs,
        selectionMode,
        status: input.status ?? currentMarker.status,
        label:
          input.label === undefined ? currentMarker.label : normalizeLabel(input.label),
        updatedAt: new Date(),
      })
      .where(eq(adBreaks.id, input.markerId)),
  ]

  if (input.variants !== undefined) {
    updateQueries.push(
      db
        .delete(adBreakVariants)
        .where(eq(adBreakVariants.adBreakId, input.markerId))
    )

    if (variants.length > 0) {
      updateQueries.push(
        db.insert(adBreakVariants).values(buildVariantRows(input.markerId, variants))
      )
    }
  }

  await runBatchQueries(updateQueries)
  await invalidatePlaybackSessions(currentMarker.episodeId)

  return loadPersistedMarker(input.markerId)
}

export const deleteMarker = async (markerId: string) => {
  const [currentMarker] = await db
    .select({
      id: adBreaks.id,
      episodeId: adBreaks.episodeId,
    })
    .from(adBreaks)
    .where(eq(adBreaks.id, markerId))
    .limit(1)

  if (!currentMarker) {
    throw new Error(`Marker not found: ${markerId}`)
  }

  const [deletedMarker] = await db
    .delete(adBreaks)
    .where(eq(adBreaks.id, markerId))
    .returning({
      id: adBreaks.id,
    })

  if (!deletedMarker) {
    throw new Error(`Marker not found: ${markerId}`)
  }

  await invalidatePlaybackSessions(currentMarker.episodeId)

  return deletedMarker
}
