import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import {
  adBreakSelectionModeEnum,
  adBreakStatusEnum,
  adBreakVariantStatusEnum,
} from "./enums"
import { episodes } from "./episodes"
import { adAssets } from "./media"

export const adBreaks = pgTable(
  "ad_breaks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    requestedTimeMs: integer("requested_time_ms").notNull(),
    resolvedTimeMs: integer("resolved_time_ms"),
    resolutionStrategy: varchar("resolution_strategy", { length: 64 }),
    selectionMode: adBreakSelectionModeEnum("selection_mode")
      .notNull()
      .default("static"),
    status: adBreakStatusEnum("status").notNull().default("draft"),
    label: varchar("label", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ad_breaks_episode_id_idx").on(table.episodeId),
    index("ad_breaks_episode_time_idx").on(table.episodeId, table.requestedTimeMs),
    index("ad_breaks_episode_status_idx").on(table.episodeId, table.status),
  ]
)

export const adBreakVariants = pgTable(
  "ad_break_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adBreakId: uuid("ad_break_id")
      .notNull()
      .references(() => adBreaks.id, { onDelete: "cascade" }),
    adAssetId: uuid("ad_asset_id")
      .notNull()
      .references(() => adAssets.id, { onDelete: "restrict" }),
    ordinal: integer("ordinal").notNull(),
    weight: integer("weight"),
    isControl: boolean("is_control"),
    status: adBreakVariantStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ad_break_variants_break_id_idx").on(table.adBreakId),
    index("ad_break_variants_asset_id_idx").on(table.adAssetId),
    uniqueIndex("ad_break_variants_break_ordinal_idx").on(
      table.adBreakId,
      table.ordinal
    ),
  ]
)
