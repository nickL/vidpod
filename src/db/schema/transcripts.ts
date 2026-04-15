import {
  integer,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { transcriptionJobStatusEnum } from "./enums"
import { mediaAssets } from "./media"

export const transcriptionJobs = pgTable(
  "transcription_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    status: transcriptionJobStatusEnum("status").notNull().default("queued"),
    phase: text("phase"),
    progressMessage: text("progress_message"),
    error: text("error"),
    totalChunks: integer("total_chunks"),
    completedChunks: integer("completed_chunks"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("transcription_jobs_media_asset_id_idx").on(table.mediaAssetId),
    index("transcription_jobs_status_idx").on(table.status),
  ]
)

export const mediaTranscripts = pgTable(
  "media_transcripts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => transcriptionJobs.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    wordsArtifactJson: jsonb("words_artifact_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("media_transcripts_media_asset_id_idx").on(table.mediaAssetId),
    index("media_transcripts_job_id_idx").on(table.jobId),
  ]
)
