import { index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core"

import { mediaAssets } from "./media"
import { shows } from "./shows"

export const episodes = pgTable(
  "episodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    showId: uuid("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 255 }).notNull(),
    displayEpisodeNumber: varchar("display_episode_number", { length: 64 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    mainMediaAssetId: uuid("main_media_asset_id").references(() => mediaAssets.id, {
      onDelete: "restrict",
    }),
    durationMs: integer("duration_ms"),
    editorConfigVersion: integer("editor_config_version").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("episodes_show_id_idx").on(table.showId),
    index("episodes_main_media_asset_id_idx").on(table.mainMediaAssetId),
  ]
)
