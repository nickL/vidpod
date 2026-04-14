import {
  integer,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import {
  adAssetStatusEnum,
  mediaAssetKindEnum,
  mediaAssetStatusEnum,
  mediaWaveformStatusEnum,
} from "./enums"
import { shows } from "./shows"

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    streamVideoId: varchar("stream_video_id", { length: 255 }).notNull(),
    kind: mediaAssetKindEnum("kind").notNull().default("video"),
    status: mediaAssetStatusEnum("status").notNull().default("uploading"),
    durationMs: integer("duration_ms"),
    playbackUrl: text("playback_url"),
    thumbnailUrl: text("thumbnail_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("media_assets_status_idx").on(table.status),
    uniqueIndex("media_assets_stream_video_id_idx").on(table.streamVideoId),
  ]
)

export const adAssets = pgTable(
  "ad_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    showId: uuid("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "restrict" }),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 255 }).notNull(),
    status: adAssetStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ad_assets_show_id_idx").on(table.showId),
    index("ad_assets_media_asset_id_idx").on(table.mediaAssetId),
    index("ad_assets_status_idx").on(table.status),
  ]
)

export const mediaWaveforms = pgTable(
  "media_waveforms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    status: mediaWaveformStatusEnum("status").notNull().default("pending"),
    peaks: jsonb("peaks").$type<number[]>(),
    bucketCount: integer("bucket_count"),
    lastError: text("last_error"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("media_waveforms_media_asset_id_idx").on(table.mediaAssetId),
    index("media_waveforms_status_idx").on(table.status),
  ]
)
