import "dotenv/config"

import { inArray, sql } from "drizzle-orm"
import { v5 as uuidv5 } from "uuid"

import { db } from "./client"
import {
  adAssets,
  adBreakVariants,
  adBreaks,
  episodes,
  mediaAssets,
  shows,
} from "./schema"

type ShowInsert = typeof shows.$inferInsert
type EpisodeInsert = typeof episodes.$inferInsert
type MediaAssetInsert = typeof mediaAssets.$inferInsert
type AdAssetInsert = typeof adAssets.$inferInsert
type AdBreakInsert = typeof adBreaks.$inferInsert
type AdBreakVariantInsert = typeof adBreakVariants.$inferInsert
type EpisodeMediaFixture = {
  durationMs: number
  streamVideoId: string
  playbackUrl: string
}

const createSeedId = (key: string) => {
  return uuidv5(key, seedNamespace)
}

const createReadyMediaAsset = (
  key: string,
  streamVideoId: string,
  options: {
    durationMs?: number
    playbackUrl?: string
    thumbnailUrl?: string
  } = {}
): MediaAssetInsert => {
  return {
    id: createSeedId(key),
    streamVideoId,
    status: "ready" as const,
    durationMs: options.durationMs,
    playbackUrl: options.playbackUrl,
    thumbnailUrl: options.thumbnailUrl,
  }
}

const createAdLibraryItem = (
  key: string,
  mediaAssetId: string,
  title: string
): AdAssetInsert => {
  return {
    id: createSeedId(key),
    showId,
    mediaAssetId,
    title,
    status: "active" as const,
  }
}

const seedNamespace = uuidv5("vidpod-seed", uuidv5.DNS)
const showId = createSeedId("show")
const episodeId = createSeedId("episode")
const episodeMediaAssetId = createSeedId("media:episode")
const eightSleepV1MediaAssetId = createSeedId("media:eight-sleep-v1")
const eightSleepV2MediaAssetId = createSeedId("media:eight-sleep-v2")
const brilliantMediaAssetId = createSeedId("media:brilliant-maths-physics")
const staticBreakId = createSeedId("break:2")
const abBreakId = createSeedId("break:3")

const episodeMediaFixtures = {
  short: {
    durationMs: 90_000,
    streamVideoId: "1f74806904cd292f47665eac3cb2c9a9",
    playbackUrl:
      "https://customer-gr52eybf6m0pbuz7.cloudflarestream.com/1f74806904cd292f47665eac3cb2c9a9/manifest/video.m3u8",
  },
  long: {
    durationMs: 780_167,
    streamVideoId: "98c7122f3165a1c0f564f9f6aa29e01f",
    playbackUrl:
      "https://customer-gr52eybf6m0pbuz7.cloudflarestream.com/98c7122f3165a1c0f564f9f6aa29e01f/manifest/video.m3u8",
  },
} satisfies Record<string, EpisodeMediaFixture>

const episodeMediaFixture = episodeMediaFixtures.long
const adDurationMs = 197_000
const now = new Date()

const show: ShowInsert = {
  id: showId,
  title: "The Diary Of A CEO",
}

const episode: EpisodeInsert = {
  id: episodeId,
  showId,
  title:
    "The Longevity Expert: The Truth About Ozempic, The Magic Weight Loss Drug & The Link Between Milk & Cancer!",
  displayEpisodeNumber: "Episode 503",
  publishedAt: new Date("2024-04-12"),
  mainMediaAssetId: episodeMediaAssetId,
  durationMs: episodeMediaFixture.durationMs,
  editorConfigVersion: 1,
}

const seedMediaAssets: MediaAssetInsert[] = [
  createReadyMediaAsset(
    "media:episode",
    episodeMediaFixture.streamVideoId,
    {
      durationMs: episodeMediaFixture.durationMs,
      playbackUrl: episodeMediaFixture.playbackUrl,
    }
  ),
  createReadyMediaAsset(
    "media:eight-sleep-v1",
    "seed-eight-sleep-q4-pod-3-v1",
    {
      durationMs: adDurationMs,
    }
  ),
  createReadyMediaAsset(
    "media:eight-sleep-v2",
    "seed-eight-sleep-q4-pod-3-v2",
    {
      durationMs: adDurationMs,
    }
  ),
  createReadyMediaAsset(
    "media:brilliant-maths-physics",
    "seed-brilliant-maths-and-physics",
    {
      durationMs: adDurationMs,
    }
  ),
]
const seedMediaStreamIds = seedMediaAssets.map((asset) => asset.streamVideoId)

const seedAdLibrary: AdAssetInsert[] = [
  createAdLibraryItem(
    "ad:eight-sleep-v1",
    eightSleepV1MediaAssetId,
    "Eight Sleep Q4 Pod 3 - v1"
  ),
  createAdLibraryItem(
    "ad:eight-sleep-v2",
    eightSleepV2MediaAssetId,
    "Eight Sleep Q4 Pod 3 - v2"
  ),
  createAdLibraryItem(
    "ad:brilliant-maths-physics",
    brilliantMediaAssetId,
    "Brilliant (maths & physics)"
  ),
]

const seedAdBreaks: AdBreakInsert[] = [
  {
    id: createSeedId("break:1"),
    episodeId,
    requestedTimeMs: 30_000,
    selectionMode: "auto",
    status: "active",
  },
  {
    id: staticBreakId,
    episodeId,
    requestedTimeMs: 320_000,
    selectionMode: "static",
    status: "active",
  },
  {
    id: abBreakId,
    episodeId,
    requestedTimeMs: 495_000,
    selectionMode: "ab",
    status: "active",
  },
]

const seedAdBreakVariants: AdBreakVariantInsert[] = [
  {
    id: createSeedId("break-variant:static:1"),
    adBreakId: staticBreakId,
    adAssetId: createSeedId("ad:eight-sleep-v1"),
    ordinal: 1,
    status: "active",
  },
  {
    id: createSeedId("break-variant:ab:1"),
    adBreakId: abBreakId,
    adAssetId: createSeedId("ad:eight-sleep-v2"),
    ordinal: 1,
    isControl: true,
    weight: 1,
    status: "active",
  },
  {
    id: createSeedId("break-variant:ab:2"),
    adBreakId: abBreakId,
    adAssetId: createSeedId("ad:brilliant-maths-physics"),
    ordinal: 2,
    weight: 1,
    status: "active",
  },
]

const seedAdTitles = seedAdLibrary.map((ad) => ad.title)

export const seedDatabase = async () => {
  const seedBreakIds = seedAdBreaks.map((b) => b.id!)
  const seedBreakVariantIds = seedAdBreakVariants.map((variant) => variant.id!)

  await db
    .delete(adBreakVariants)
    .where(inArray(adBreakVariants.id, seedBreakVariantIds))
  await db.delete(adBreaks).where(inArray(adBreaks.id, seedBreakIds))
  await db.delete(adAssets).where(inArray(adAssets.title, seedAdTitles))
  await db.delete(episodes).where(inArray(episodes.title, [episode.title]))
  await db
    .delete(mediaAssets)
    .where(inArray(mediaAssets.streamVideoId, seedMediaStreamIds))
  await db.delete(shows).where(inArray(shows.title, [show.title]))

  await db
    .insert(shows)
    .values(show)
    .onConflictDoUpdate({
      target: shows.id,
      set: {
        title: show.title,
        archivedAt: null,
        updatedAt: now,
      },
    })

  await db
    .insert(mediaAssets)
    .values(seedMediaAssets)
    .onConflictDoUpdate({
      target: mediaAssets.id,
      set: {
        streamVideoId: sql`excluded.stream_video_id`,
        status: sql`excluded.status`,
        durationMs: sql`excluded.duration_ms`,
        playbackUrl: sql`excluded.playback_url`,
        thumbnailUrl: sql`excluded.thumbnail_url`,
        updatedAt: now,
      },
    })

  await db
    .insert(episodes)
    .values(episode)
    .onConflictDoUpdate({
      target: episodes.id,
      set: {
        showId: episode.showId,
        title: episode.title,
        displayEpisodeNumber: episode.displayEpisodeNumber,
        publishedAt: episode.publishedAt,
        mainMediaAssetId: episode.mainMediaAssetId,
        durationMs: episode.durationMs,
        editorConfigVersion: episode.editorConfigVersion,
        archivedAt: null,
        updatedAt: now,
      },
    })

  await db
    .insert(adAssets)
    .values(seedAdLibrary)
    .onConflictDoUpdate({
      target: adAssets.id,
      set: {
        showId: sql`excluded.show_id`,
        mediaAssetId: sql`excluded.media_asset_id`,
        title: sql`excluded.title`,
        status: sql`excluded.status`,
        updatedAt: now,
      },
    })

  await db
    .insert(adBreaks)
    .values(seedAdBreaks)
    .onConflictDoUpdate({
      target: adBreaks.id,
      set: {
        episodeId: sql`excluded.episode_id`,
        requestedTimeMs: sql`excluded.requested_time_ms`,
        selectionMode: sql`excluded.selection_mode`,
        status: sql`excluded.status`,
        updatedAt: now,
      },
    })

  await db
    .insert(adBreakVariants)
    .values(seedAdBreakVariants)
    .onConflictDoUpdate({
      target: adBreakVariants.id,
      set: {
        adBreakId: sql`excluded.ad_break_id`,
        adAssetId: sql`excluded.ad_asset_id`,
        ordinal: sql`excluded.ordinal`,
        weight: sql`excluded.weight`,
        isControl: sql`excluded.is_control`,
        status: sql`excluded.status`,
        updatedAt: now,
      },
    })

  return {
    showId: show.id,
    episodeId: episode.id,
  }
}

const run = async () => {
  await seedDatabase()
  console.log("Seeded and Ready!")
}

run().catch((error) => {
  console.error(`Uh ohs:  ${error}`)
  process.exit(1)
})
