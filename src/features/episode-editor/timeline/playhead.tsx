import { CONTENT_HORIZONTAL_INSET_PX, timeToPx } from "./shared"

type PlayheadProps = {
  currentTimeMs: number
  timelineLengthMs: number
  contentWidthPx: number
  trackTopOffset: number
  trackHeight: number
  isDragging: boolean
  onDragStart: (event: React.PointerEvent<HTMLDivElement>) => void
  onDragMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onDragEnd: (event: React.PointerEvent<HTMLDivElement>) => void
  onDragCancel: (event: React.PointerEvent<HTMLDivElement>) => void
}

const HANDLE_SIZE = 31
const HANDLE_HITBOX_WIDTH = 32
const HANDLE_RADIUS = 5.5
const NEEDLE_WIDTH = 3
const HANDLE_TRACK_GAP = 8
const HANDLE_DOT_GRID = {
  columns: 2,
  rows: 3,
  columnGap: 4.5,
  rowGap: 5,
  dotRadius: 1.5,
  strokeWidth: 1.45,
}

export const Playhead = ({
  currentTimeMs,
  timelineLengthMs,
  contentWidthPx,
  trackTopOffset,
  trackHeight,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: PlayheadProps) => {
  if (timelineLengthMs <= 0 || contentWidthPx <= 0) {
    return null
  }

  const playheadLeftPx = clampPlayheadX(
    timeToPx(currentTimeMs, timelineLengthMs, contentWidthPx),
    contentWidthPx
  )

  const handleTop = trackTopOffset - HANDLE_SIZE - HANDLE_TRACK_GAP
  const needleTop = handleTop + HANDLE_SIZE
  const needleHeight = trackTopOffset + trackHeight - needleTop

  return (
    <div
      className="absolute top-0 z-10"
      style={{
        left: `${playheadLeftPx}px`,
        height: trackTopOffset + trackHeight,
      }}
    >
      <div
        className={`pointer-events-auto absolute left-1/2 top-0 h-full -translate-x-1/2 touch-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ width: HANDLE_HITBOX_WIDTH }}
        onClick={(event) => event.stopPropagation()}
        onPointerCancel={onDragCancel}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
      >
        <PlayheadHandle top={handleTop} />
        <PlayheadNeedle top={needleTop} height={needleHeight} />
      </div>
    </div>
  )
}

const PlayheadHandle = ({ top }: { top: number }) => {
  return (
    <div className="absolute left-1/2 -translate-x-1/2" style={{ top }}>
      <svg
        width={HANDLE_SIZE}
        height={HANDLE_SIZE}
        viewBox={`0 0 ${HANDLE_SIZE} ${HANDLE_SIZE}`}
      >
        <rect
          x={0}
          y={0}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          rx={HANDLE_RADIUS}
          fill="#EF4444"
        />

        {Array.from({ length: HANDLE_DOT_GRID.rows }, (_, row) =>
          Array.from({ length: HANDLE_DOT_GRID.columns }, (_, col) => (
            <circle
              key={`${row}-${col}`}
              cx={HANDLE_SIZE / 2 + (col - 0.5) * HANDLE_DOT_GRID.columnGap}
              cy={
                HANDLE_SIZE / 2 -
                HANDLE_DOT_GRID.rowGap +
                row * HANDLE_DOT_GRID.rowGap
              }
              r={HANDLE_DOT_GRID.dotRadius}
              fill="none"
              stroke="#FAFAFA"
              strokeWidth={HANDLE_DOT_GRID.strokeWidth}
            />
          ))
        )}
      </svg>
    </div>
  )
}

const PlayheadNeedle = ({
  top,
  height,
}: {
  top: number
  height: number
}) => (
  <div
    className="absolute left-1/2 -translate-x-1/2 bg-red-500"
    style={{ top, width: NEEDLE_WIDTH, height }}
  />
)

const clampPlayheadX = (
  leftPx: number,
  contentWidthPx: number
) => {
  const minX = CONTENT_HORIZONTAL_INSET_PX
  const maxX = contentWidthPx - CONTENT_HORIZONTAL_INSET_PX

  if (maxX <= minX) {
    return contentWidthPx / 2
  }

  return Math.max(minX, Math.min(leftPx, maxX))
}
