import { describe, expect, it } from "vitest"

import {
  canMarkerPlay,
  resolveMarkerVariant,
} from "./marker-selection"

import type { PlaybackMarker } from "./marker-selection"

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
        adAssetId: "ad-asset-1",
        status: "active",
        mediaStatus: "ready",
      },
    ],
    ...overrides,
  }
}

describe("marker selection", () => {
  it("static plays when there's one variant and its ready", () => {
    expect(
      canMarkerPlay({ episodeDurationMs: 300_000, marker: createMarker() })
    ).toBe(true)
  })

  it("auto plays when at least one variant is playable", () => {
    expect(
      canMarkerPlay({
        episodeDurationMs: 300_000,
        marker: createMarker({ selectionMode: "auto" }),
      })
    ).toBe(true)
  })

  it("draft markers can't play", () => {
    expect(
      canMarkerPlay({
        episodeDurationMs: 300_000,
        marker: createMarker({ status: "draft" }),
      })
    ).toBe(false)
  })

  it("marker can't extend past the episode end", () => {
    expect(
      canMarkerPlay({ episodeDurationMs: 35_000, marker: createMarker() })
    ).toBe(false)
  })

  it("A/B fails when only one variant is playable", () => {
    expect(
      canMarkerPlay({
        episodeDurationMs: 300_000,
        marker: createMarker({
          selectionMode: "ab",
          variants: [
            {
              id: "variant-1",
              adAssetId: "ad-asset-1",
              status: "active",
              mediaStatus: "ready",
            },
            {
              id: "variant-2",
              adAssetId: "ad-asset-2",
              status: "active",
              mediaStatus: "failed",
            },
          ],
        }),
      })
    ).toBe(false)
  })

  it("weighted auto picks the heavier variant", () => {
    const variant = resolveMarkerVariant(
      createMarker({
        selectionMode: "auto",
        variants: [
          {
            id: "variant-1",
            adAssetId: "ad-asset-1",
            status: "active",
            mediaStatus: "ready",
            weight: 1,
          },
          {
            id: "variant-2",
            adAssetId: "ad-asset-2",
            status: "active",
            mediaStatus: "ready",
            weight: 3,
          },
        ],
      }),
      () => 0.9
    )

    expect(variant?.id).toBe("variant-2")
  })
})
