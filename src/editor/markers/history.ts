import type { Marker } from "../types"

export type MarkerHistoryEntry =
  | {
      kind: "create"
      marker: Marker
    }
  | {
      kind: "delete"
      marker: Marker
    }
  | {
      kind: "update"
      before: Marker
      after: Marker
    }
  | {
      kind: "batch"
      changes: MarkerHistoryEntry[]
    }
