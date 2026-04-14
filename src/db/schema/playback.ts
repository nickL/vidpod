import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import {
  adBreakSelectionModeEnum,
  playbackEventTypeEnum,
  playbackSessionModeEnum,
  playbackSessionStatusEnum,
} from "./enums"
import { adBreakVariants, adBreaks } from "./ad-breaks"
import { episodes } from "./episodes"

export const playbackSessions = pgTable(
  "playback_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    mode: playbackSessionModeEnum("mode").notNull().default("editor_preview"),
    status: playbackSessionStatusEnum("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("playback_sessions_episode_id_idx").on(table.episodeId),
    index("playback_sessions_episode_status_idx").on(table.episodeId, table.status),
  ]
)

export const playbackBreakResolutions = pgTable(
  "playback_break_resolutions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playbackSessionId: uuid("playback_session_id")
      .notNull()
      .references(() => playbackSessions.id, { onDelete: "cascade" }),
    adBreakId: uuid("ad_break_id")
      .notNull()
      .references(() => adBreaks.id, { onDelete: "cascade" }),
    selectedVariantId: uuid("selected_variant_id")
      .notNull()
      .references(() => adBreakVariants.id, { onDelete: "restrict" }),
    selectionMode: adBreakSelectionModeEnum("selection_mode").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("playback_break_resolutions_session_id_idx").on(table.playbackSessionId),
    index("playback_break_resolutions_break_id_idx").on(table.adBreakId),
    uniqueIndex("playback_break_resolutions_session_break_idx").on(
      table.playbackSessionId,
      table.adBreakId
    ),
  ]
)

export const playbackEvents = pgTable(
  "playback_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playbackSessionId: uuid("playback_session_id")
      .notNull()
      .references(() => playbackSessions.id, { onDelete: "cascade" }),
    adBreakId: uuid("ad_break_id").references(() => adBreaks.id, {
      onDelete: "set null",
    }),
    selectedVariantId: uuid("selected_variant_id").references(
      () => adBreakVariants.id,
      {
        onDelete: "set null",
      }
    ),
    eventType: playbackEventTypeEnum("event_type").notNull(),
    playheadTimeMs: integer("playhead_time_ms"),
    metadataJson: jsonb("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("playback_events_session_id_idx").on(table.playbackSessionId),
    index("playback_events_break_id_idx").on(table.adBreakId),
    index("playback_events_type_idx").on(table.eventType),
  ]
)
