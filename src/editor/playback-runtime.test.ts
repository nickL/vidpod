import { describe, expect, it } from "vitest"

import {
  getMarkerPlaybackReadiness,
  resolveMarkerVariant,
} from "./playback-runtime"

import type { PlaybackMarker } from "./playback-runtime"

const createMarker = (
  overrides: Partial<PlaybackMarker> = {}
): PlaybackMarker => {
  return {
    id: "marker-1",
    requestedTimeMs: 30_000,
    selectionMode: "static",
    status: "active",
    variants: [
      {
        id: "variant-1",
        status: "active",
        mediaStatus: "ready",
      },
    ],
    ...overrides,
  }
}

describe("playback runtime", () => {
  it("marks a playable static break as ready", () => {
    const readiness = getMarkerPlaybackReadiness({
      episodeDurationMs: 300_000,
      marker: createMarker(),
    })

    expect(readiness).toEqual({
      canPlay: true,
    })
  })

  it("treats draft setup guidance differently from active warnings", () => {
    const draftReadiness = getMarkerPlaybackReadiness({
      episodeDurationMs: 300_000,
      marker: createMarker({
        status: "draft",
        variants: [],
      }),
    })
    const activeReadiness = getMarkerPlaybackReadiness({
      episodeDurationMs: 300_000,
      marker: createMarker({
        status: "active",
        variants: [],
      }),
    })

    expect(draftReadiness).toEqual({
      canPlay: false,
      reasonCode: "needs_variant",
      reasonSeverity: "guidance",
    })
    expect(activeReadiness).toEqual({
      canPlay: false,
      reasonCode: "needs_variant",
      reasonSeverity: "warning",
    })
  })

  it("rejects a break that runs past the episode end", () => {
    const readiness = getMarkerPlaybackReadiness({
      episodeDurationMs: 35_000,
      marker: createMarker(),
    })

    expect(readiness).toEqual({
      canPlay: false,
      reasonCode: "invalid_break_time",
      reasonSeverity: "warning",
    })
  })

  it("needs two playable variants for A/B", () => {
    const readiness = getMarkerPlaybackReadiness({
      episodeDurationMs: 300_000,
      marker: createMarker({
        selectionMode: "ab",
        variants: [
          {
            id: "variant-1",
            status: "active",
            mediaStatus: "ready",
          },
          {
            id: "variant-2",
            status: "active",
            mediaStatus: "failed",
          },
        ],
      }),
    })

    expect(readiness).toEqual({
      canPlay: false,
      reasonCode: "asset_unavailable",
      reasonSeverity: "warning",
    })
  })

  it("uses weights for auto selection when they exist", () => {
    const resolvedVariant = resolveMarkerVariant(
      createMarker({
        selectionMode: "auto",
        variants: [
          {
            id: "variant-1",
            status: "active",
            mediaStatus: "ready",
            weight: 1,
          },
          {
            id: "variant-2",
            status: "active",
            mediaStatus: "ready",
            weight: 3,
          },
        ],
      }),
      () => 0.9
    )

    expect(resolvedVariant?.id).toBe("variant-2")
  })
})
