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
  playbackSessions,
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

type SeedAdMediaFixture = {
  key: string
  title: string
  durationMs: number
  streamVideoId: string
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
const getSeedMediaAssetId = (key: string) => createSeedId(`media:${key}`)
const getSeedAdAssetId = (key: string) => createSeedId(`ad:${key}`)
const streamCustomerHostname = "customer-gr52eybf6m0pbuz7.cloudflarestream.com"
const buildStreamPlaybackUrl = (streamVideoId: string) =>
  `https://${streamCustomerHostname}/${streamVideoId}/manifest/video.m3u8`
const buildStreamThumbnailUrl = (streamVideoId: string) =>
  `https://${streamCustomerHostname}/${streamVideoId}/thumbnails/thumbnail.jpg`
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
const now = new Date()

const seedAdMediaFixtures = [
  {
    key: "example-ad-01-90s",
    title: "Example Ad 01 (90s)",
    durationMs: 60_200,
    streamVideoId: "2fd6f89938c1a986fb391f679410d45d",
  },
  {
    key: "example-ad-02-90s",
    title: "Example Ad 02 (90s)",
    durationMs: 30_000,
    streamVideoId: "a3128a53bbb0c5b7aa014e496e649e18",
  },
  {
    key: "example-ad-03-90s",
    title: "Example Ad 03 (90s)",
    durationMs: 54_500,
    streamVideoId: "065a321eb2c44b1ef1dfc9a0a5c1781c",
  },
  {
    key: "example-ad-04-90s",
    title: "Example Ad 04 (90s)",
    durationMs: 30_000,
    streamVideoId: "56d604f67bbeb15512ca9e5445274ec1",
  },
  {
    key: "example-ad-05-90s",
    title: "Example Ad 05 (90s)",
    durationMs: 30_200,
    streamVideoId: "88ab00380bd7f92bd8b0fe5be7514536",
  },
  {
    key: "example-ad-06-classic",
    title: "Example Ad 06 (Classic)",
    durationMs: 51_200,
    streamVideoId: "63a798000147bcdf1b942e1816da32ed",
  },
  {
    key: "example-ad-07-classic",
    title: "Example Ad 07 (Classic)",
    durationMs: 89_000,
    streamVideoId: "2312e3c821464b3abc80e962d66e4c85",
  },
  {
    key: "example-ad-08-classic",
    title: "Example Ad 08 (Classic)",
    durationMs: 60_500,
    streamVideoId: "40c6f31c3a592de0554f62878525763a",
  },
  {
    key: "example-ad-09-classic",
    title: "Example Ad 09 (Classic)",
    durationMs: 60_000,
    streamVideoId: "338992f3b4a42bf72ccae4a463d6170d",
  },
] satisfies SeedAdMediaFixture[]

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
  ...seedAdMediaFixtures.map((fixture) =>
    createReadyMediaAsset(`media:${fixture.key}`, fixture.streamVideoId, {
      durationMs: fixture.durationMs,
      playbackUrl: buildStreamPlaybackUrl(fixture.streamVideoId),
      thumbnailUrl: buildStreamThumbnailUrl(fixture.streamVideoId),
    })
  ),
]

const seedAdLibrary: AdAssetInsert[] = seedAdMediaFixtures.map((fixture) =>
  createAdLibraryItem(
    `ad:${fixture.key}`,
    getSeedMediaAssetId(fixture.key),
    fixture.title
  )
)

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
    id: createSeedId("break-variant:auto:1"),
    adBreakId: createSeedId("break:1"),
    adAssetId: getSeedAdAssetId("example-ad-01-90s"),
    ordinal: 1,
    weight: 3,
    status: "active",
  },
  {
    id: createSeedId("break-variant:auto:2"),
    adBreakId: createSeedId("break:1"),
    adAssetId: getSeedAdAssetId("example-ad-02-90s"),
    ordinal: 2,
    weight: 2,
    status: "active",
  },
  {
    id: createSeedId("break-variant:auto:3"),
    adBreakId: createSeedId("break:1"),
    adAssetId: getSeedAdAssetId("example-ad-06-classic"),
    ordinal: 3,
    weight: 1,
    status: "active",
  },
  {
    id: createSeedId("break-variant:static:1"),
    adBreakId: staticBreakId,
    adAssetId: getSeedAdAssetId("example-ad-04-90s"),
    ordinal: 1,
    status: "active",
  },
  {
    id: createSeedId("break-variant:ab:1"),
    adBreakId: abBreakId,
    adAssetId: getSeedAdAssetId("example-ad-05-90s"),
    ordinal: 1,
    isControl: true,
    weight: 1,
    status: "active",
  },
  {
    id: createSeedId("break-variant:ab:2"),
    adBreakId: abBreakId,
    adAssetId: getSeedAdAssetId("example-ad-09-classic"),
    ordinal: 2,
    weight: 1,
    status: "active",
  },
]

const legacySeedAdTitles = [
  "Eight Sleep Q4 Pod 3 - v1",
  "Eight Sleep Q4 Pod 3 - v2",
  "Brilliant (maths & physics)",
]
const seedAdTitles = [...legacySeedAdTitles, ...seedAdLibrary.map((ad) => ad.title)]

export const seedDatabase = async () => {
  const seedBreakIds = seedAdBreaks.map((b) => b.id!)

  await db.delete(playbackSessions).where(inArray(playbackSessions.episodeId, [episodeId]))
  await db
    .delete(adBreakVariants)
    .where(inArray(adBreakVariants.adBreakId, seedBreakIds))
  await db.delete(adBreaks).where(inArray(adBreaks.id, seedBreakIds))
  await db.delete(adAssets).where(inArray(adAssets.title, seedAdTitles))

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
