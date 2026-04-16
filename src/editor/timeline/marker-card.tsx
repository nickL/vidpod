import Image from "next/image"
import { cva } from "class-variance-authority"

import { Spacer } from "@/components/ui/spacer"
import { cn } from "@/lib/utils"

import type { Marker } from "../types"

const cardVariants = cva(
  "flex h-full min-w-0 flex-col items-center overflow-hidden rounded-md",
  {
    variants: {
      mode: {
        auto: "bg-green-300",
        static: "bg-blue-300",
        ab: "bg-orange-300",
      },
    },
  }
)

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[5px] border text-[11px] leading-none font-medium",
  {
    variants: {
      mode: {
        auto: "border-green-800 text-green-800",
        static: "border-blue-800 text-blue-800",
        ab: "border-orange-800 text-orange-800",
      },
    },
  }
)

const gripFill: Record<Marker["selectionMode"], string> = {
  auto: "fill-green-800",
  static: "fill-blue-800",
  ab: "fill-orange-800",
}

const badgeLabels: Record<Marker["selectionMode"], string> = {
  auto: "A",
  static: "S",
  ab: "A/B",
}

const gripDots = {
  cols: 2,
  rows: 3,
  colGap: 4,
  rowGap: 4.67,
  dotRadius: 1.33,
} as const

const gripWidth =
  (gripDots.cols - 1) * gripDots.colGap + gripDots.dotRadius * 2
const gripHeight =
  (gripDots.rows - 1) * gripDots.rowGap + gripDots.dotRadius * 2

type MarkerCardProps = {
  marker: Marker
}

export const MarkerCard = ({ marker }: MarkerCardProps) => {
  const selectionMode = marker.selectionMode
  const isStatic = selectionMode === "static"
  const staticThumbnailUrl = marker.variants[0]?.thumbnailUrl

  return (
    <div className={cardVariants({ mode: selectionMode })}>
      <Badge mode={selectionMode} centered={isStatic} />

      {isStatic ? (
        <>
          <MarkerThumbnail
            thumbnailUrl={staticThumbnailUrl}
            title={marker.variants[0]?.adAssetTitle}
          />
          <GripHandle mode={selectionMode} centered />
        </>
      ) : (
        <>
          <Spacer />
          <GripHandle mode={selectionMode} />
        </>
      )}
    </div>
  )
}

const Badge = ({
  mode,
  centered,
}: {
  mode: Marker["selectionMode"]
  centered?: boolean
}) => {
  const label = badgeLabels[mode]

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center px-1",
        centered ? "flex-1" : "shrink-0 pt-2 pb-1"
      )}
    >
      <span
        className={badgeVariants({ mode })}
        style={{
          minWidth: 16,
          height: 16,
          paddingInline: label.length > 1 ? 3 : 0,
        }}
      >
        {label}
      </span>
    </div>
  )
}

const MarkerThumbnail = ({
  thumbnailUrl,
  title,
}: {
  thumbnailUrl?: string
  title?: string
}) => {
  if (!thumbnailUrl) {
    return <div className="h-10 w-full max-w-24 shrink-0" aria-hidden="true" />
  }

  return (
    <div className="flex w-full shrink-0 justify-center">
      <div className="w-full max-w-24 border-y-2 border-zinc-950">
        <div className="flex h-10 items-center justify-center overflow-hidden bg-zinc-100">
          <div className="relative h-full w-full">
            <Image
              src={thumbnailUrl}
              alt={title ?? "Ad preview"}
              fill
              unoptimized
              sizes="128px"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const GripHandle = ({
  mode,
  centered,
}: {
  mode: Marker["selectionMode"]
  centered?: boolean
}) => {
  return (
    <div
      className={cn(
        "flex items-center justify-center px-1",
        centered ? "flex-1" : "shrink-0 py-2"
      )}
    >
      <svg
        width={gripWidth}
        height={gripHeight}
        viewBox={`0 0 ${gripWidth} ${gripHeight}`}
        className={gripFill[mode]}
      >
        {Array.from({ length: gripDots.rows }, (_, row) =>
          Array.from({ length: gripDots.cols }, (_, col) => (
            <circle
              key={`${row}-${col}`}
              cx={col * gripDots.colGap + gripDots.dotRadius}
              cy={row * gripDots.rowGap + gripDots.dotRadius}
              r={gripDots.dotRadius}
            />
          ))
        )}
      </svg>
    </div>
  )
}
