"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { Spacer } from "@/components/ui/spacer"

import type { Marker, MarkerActivation, MediaWaveform } from "../types"

import { Playhead } from "./playhead"
import {
  MARKER_DURATION_MS,
  clampToTimeline,
  pxToTime,
  selectMinorTickMs,
  selectRulerScale,
  timeToPx,
} from "./shared"
import { Toolbar } from "./toolbar"
import { Track } from "./track"
import { Ruler } from "./ruler"
import { TimelineScrollbar } from "./timeline-scrollbar"
import type { RulerScale } from "./shared"

const HANDLE_ZONE_HEIGHT = 32
const TRACK_HEIGHT = 128
const PLAYHEAD_OVERFLOW_TOP_PX = 16
const PLAYHEAD_OVERFLOW_SIDE_PX = 16
const MIN_ZOOM_FACTOR = 1
const MAX_ZOOM_FACTOR = 6
const ZOOM_BUTTON_STEP = 10
const MARKER_DRAG_START_THRESHOLD_PX = 3
const VIEWPORT_SEEK_THRESHOLD_PX = 3
const VIEWPORT_FOLLOW_PADDING_PX = 24
const ZOOM_EPSILON = 0.001

type ViewportSeekState = {
  pointerId: number
  startClientX: number
  startClientY: number
  canSeek: boolean
}

type MarkerDragState = {
  markerId: string
  pointerId: number
  startClientX: number
  minRequestedTimeMs: number
  maxRequestedTimeMs: number
  pointerOffsetMs: number
}

type DroppedMarkerPosition = {
  markerId: string
  requestedTimeMs: number
}

type TimelineProps = {
  markers: Marker[]
  displayTimeMs: number
  durationMs: number
  waveform?: MediaWaveform
  markerActivation?: MarkerActivation
  selectedMarkerId?: string
  onMarkerTimeCommit: (markerId: string, requestedTimeMs: number) => void
  onActivateMarker: (markerId: string, requestedTimeMs: number) => void
  onSelectMarker: (markerId: string) => void
  onScrubChange: (timeMs: number) => void
  onScrubEnd: () => void
  onScrubStart: () => void
}

export const Timeline = ({
  markers,
  displayTimeMs,
  durationMs,
  waveform,
  markerActivation,
  selectedMarkerId,
  onMarkerTimeCommit,
  onActivateMarker,
  onSelectMarker,
  onScrubChange,
  onScrubEnd,
  onScrubStart,
}: TimelineProps) => {
  const viewportRef = useRef<HTMLDivElement>(null)
  const viewportSeekStateRef = useRef<ViewportSeekState | null>(null)
  const markerDragStateRef = useRef<MarkerDragState | null>(null)
  const nextZoomScrollLeftRef = useRef<number | undefined>(undefined)
  const [viewportWidthPx, setViewportWidthPx] = useState(0)
  const [scrollLeftPx, setScrollLeftPx] = useState(0)
  const [zoomFactor, setZoomFactor] = useState(MIN_ZOOM_FACTOR)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [droppedMarkerPosition, setDroppedMarkerPosition] =
    useState<DroppedMarkerPosition | null>(null)
  const [markerDragState, setMarkerDragState] = useState<MarkerDragState | null>(
    null
  )
  const [draftRequestedTimeMs, setDraftRequestedTimeMs] = useState<number>()

  const timelineDurationMs = Math.max(durationMs, 1)
  const contentWidthPx = getContentWidthPx(viewportWidthPx, zoomFactor)
  const maxScrollLeftPx = Math.max(contentWidthPx - viewportWidthPx, 0)
  const zoomPercent = getZoomPercentFromFactor(zoomFactor)
  const canZoomIn = zoomFactor < MAX_ZOOM_FACTOR - ZOOM_EPSILON
  const canZoomOut = zoomFactor > MIN_ZOOM_FACTOR + ZOOM_EPSILON
  const defaultRulerScale = useMemo<RulerScale>(
    () => selectRulerScale(timelineDurationMs, viewportWidthPx),
    [timelineDurationMs, viewportWidthPx]
  )
  const rulerScale = useMemo<RulerScale>(
    () => ({
      majorTickMs: defaultRulerScale.majorTickMs,
      minorTickMs: selectMinorTickMs(
        timelineDurationMs,
        contentWidthPx,
        defaultRulerScale.majorTickMs,
        defaultRulerScale.minorTickMs
      ),
    }),
    [contentWidthPx, defaultRulerScale, timelineDurationMs]
  )
  const timelineMarkers = useMemo(() => {
    if (!markerDragState || draftRequestedTimeMs === undefined) {
      if (!droppedMarkerPosition) {
        return markers
      }

      return markers.map((marker) =>
        marker.id === droppedMarkerPosition.markerId
          ? { ...marker, requestedTimeMs: droppedMarkerPosition.requestedTimeMs }
          : marker
      )
    }

    return markers.map((marker) =>
      marker.id === markerDragState.markerId
        ? { ...marker, requestedTimeMs: draftRequestedTimeMs }
        : marker
    )
  }, [draftRequestedTimeMs, droppedMarkerPosition, markerDragState, markers])

  useEffect(() => {
    markerDragStateRef.current = markerDragState
  }, [markerDragState])

  const clearMarkerDrag = useCallback(() => {
    markerDragStateRef.current = null
    setMarkerDragState(null)
    setDraftRequestedTimeMs(undefined)
  }, [])

  useEffect(() => {
    if (!droppedMarkerPosition) {
      return
    }

    const marker = markers.find(
      (currentMarker) => currentMarker.id === droppedMarkerPosition.markerId
    )

    if (
      marker &&
      marker.requestedTimeMs !== droppedMarkerPosition.requestedTimeMs
    ) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      setDroppedMarkerPosition((currentPosition) => {
        if (!currentPosition) {
          return currentPosition
        }

        return currentPosition.markerId === droppedMarkerPosition.markerId &&
          currentPosition.requestedTimeMs === droppedMarkerPosition.requestedTimeMs
          ? null
          : currentPosition
      })
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [droppedMarkerPosition, markers])

  const scrollViewportTo = useCallback((nextScrollLeftPx: number) => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    const clampedScrollLeftPx = Math.max(0, nextScrollLeftPx)

    viewport.scrollLeft = clampedScrollLeftPx
    setScrollLeftPx(clampedScrollLeftPx)
  }, [])

  useLayoutEffect(() => {
    const nextZoomScrollLeftPx = nextZoomScrollLeftRef.current
    const viewport = viewportRef.current

    if (nextZoomScrollLeftPx === undefined || !viewport) {
      return
    }

    viewport.scrollLeft = nextZoomScrollLeftPx
    nextZoomScrollLeftRef.current = undefined
  }, [contentWidthPx])

  useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    const updateViewportWidth = () => {
      setViewportWidthPx(viewport.clientWidth)
    }

    updateViewportWidth()

    const observer = new ResizeObserver(() => {
      updateViewportWidth()
    })

    observer.observe(viewport)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport || viewport.scrollLeft <= maxScrollLeftPx) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      scrollViewportTo(maxScrollLeftPx)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [maxScrollLeftPx, scrollViewportTo])

  const getTimeAtPointerX = useCallback(
    (pointerX: number) => {
      const viewport = viewportRef.current

      if (!viewport || contentWidthPx <= 0) {
        return 0
      }

      const rect = viewport.getBoundingClientRect()
      const xPx = pointerX - rect.left + viewport.scrollLeft

      return clampToTimeline(
        pxToTime(xPx, timelineDurationMs, contentWidthPx),
        timelineDurationMs
      )
    },
    [contentWidthPx, timelineDurationMs]
  )

  const handleViewportScroll = useCallback(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    nextZoomScrollLeftRef.current = undefined
    setScrollLeftPx(viewport.scrollLeft)
  }, [])

  const handleViewportPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || isDraggingPlayhead) {
        return
      }

      viewportSeekStateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        canSeek: true,
      }
    },
    [isDraggingPlayhead]
  )

  const handleViewportPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const viewportSeekState = viewportSeekStateRef.current

      if (!viewportSeekState || event.pointerId !== viewportSeekState.pointerId) {
        return
      }

      const movedFarEnough =
        Math.abs(event.clientX - viewportSeekState.startClientX) >=
          VIEWPORT_SEEK_THRESHOLD_PX ||
        Math.abs(event.clientY - viewportSeekState.startClientY) >=
          VIEWPORT_SEEK_THRESHOLD_PX

      if (movedFarEnough) {
        viewportSeekStateRef.current = {
          ...viewportSeekState,
          canSeek: false,
        }
      }
    },
    []
  )

  const handleViewportPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const viewportSeekState = viewportSeekStateRef.current

      if (!viewportSeekState || event.pointerId !== viewportSeekState.pointerId) {
        return
      }

      viewportSeekStateRef.current = null

      if (!viewportSeekState.canSeek) {
        return
      }

      const timeMs = getTimeAtPointerX(event.clientX)

      onScrubStart()
      onScrubChange(timeMs)
      onScrubEnd()
    },
    [getTimeAtPointerX, onScrubChange, onScrubEnd, onScrubStart]
  )

  const handleViewportPointerCancel = useCallback(() => {
    viewportSeekStateRef.current = null
  }, [])

  const handleMarkerDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, markerId: string) => {
      const marker = markers.find((currentMarker) => currentMarker.id === markerId)

      if (!marker) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      onSelectMarker(markerId)

      const pointerTimeMs = getTimeAtPointerX(event.clientX)
      const { minRequestedTimeMs, maxRequestedTimeMs } = getMarkerDragBounds(
        markers,
        markerId,
        timelineDurationMs
      )
      const startRequestedTimeMs = clampMarkerRequestedTime(
        marker.requestedTimeMs,
        minRequestedTimeMs,
        maxRequestedTimeMs
      )

      const nextDragState = {
        markerId,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        minRequestedTimeMs,
        maxRequestedTimeMs,
        pointerOffsetMs: pointerTimeMs - marker.requestedTimeMs,
      }

      markerDragStateRef.current = nextDragState
      setMarkerDragState(nextDragState)
      setDraftRequestedTimeMs(startRequestedTimeMs)
    },
    [getTimeAtPointerX, markers, onSelectMarker, timelineDurationMs]
  )

  const finishMarkerDrag = useCallback(
    (
      markerId: string,
      nextRequestedTimeMs: number | undefined,
      didDrag: boolean
    ) => {
      const marker = markers.find((currentMarker) => currentMarker.id === markerId)

      if (!marker || nextRequestedTimeMs === undefined) {
        clearMarkerDrag()
        return
      }

      if (didDrag && marker.requestedTimeMs !== nextRequestedTimeMs) {
        setDroppedMarkerPosition({
          markerId,
          requestedTimeMs: nextRequestedTimeMs,
        })
        onMarkerTimeCommit(markerId, nextRequestedTimeMs)
      } else {
        setDroppedMarkerPosition(null)
        onActivateMarker(markerId, marker.requestedTimeMs)
      }

      clearMarkerDrag()
    },
    [clearMarkerDrag, markers, onActivateMarker, onMarkerTimeCommit]
  )

  const cancelMarkerDrag = useCallback(() => {
    clearMarkerDrag()
  }, [clearMarkerDrag])

  useEffect(() => {
    if (!markerDragState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const currentDragState = markerDragStateRef.current

      if (!currentDragState || event.pointerId !== currentDragState.pointerId) {
        return
      }

      event.preventDefault()

      const pointerTimeMs = getTimeAtPointerX(event.clientX)
      const nextRequestedTimeMs = clampMarkerRequestedTime(
        pointerTimeMs - currentDragState.pointerOffsetMs,
        currentDragState.minRequestedTimeMs,
        currentDragState.maxRequestedTimeMs
      )

      setDraftRequestedTimeMs(nextRequestedTimeMs)
    }

    const handlePointerUp = (event: PointerEvent) => {
      const currentDragState = markerDragStateRef.current

      if (!currentDragState || event.pointerId !== currentDragState.pointerId) {
        return
      }

      event.preventDefault()

      const pointerTimeMs = getTimeAtPointerX(event.clientX)
      const nextRequestedTimeMs = clampMarkerRequestedTime(
        pointerTimeMs - currentDragState.pointerOffsetMs,
        currentDragState.minRequestedTimeMs,
        currentDragState.maxRequestedTimeMs
      )
      const didDrag =
        Math.abs(event.clientX - currentDragState.startClientX) >=
        MARKER_DRAG_START_THRESHOLD_PX

      finishMarkerDrag(
        currentDragState.markerId,
        nextRequestedTimeMs,
        didDrag
      )
    }

    const handlePointerCancel = (event: PointerEvent) => {
      const currentDragState = markerDragStateRef.current

      if (!currentDragState || event.pointerId !== currentDragState.pointerId) {
        return
      }

      cancelMarkerDrag()
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerCancel)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerCancel)
    }
  }, [cancelMarkerDrag, finishMarkerDrag, getTimeAtPointerX, markerDragState])

  const zoomToFactor = useCallback(
    (nextZoomFactor: number) => {
      if (viewportWidthPx <= 0) {
        return
      }

      const clampedZoomFactor = Math.max(
        MIN_ZOOM_FACTOR,
        Math.min(nextZoomFactor, MAX_ZOOM_FACTOR)
      )

      if (Math.abs(clampedZoomFactor - zoomFactor) < ZOOM_EPSILON) {
        return
      }

      const viewport = viewportRef.current
      const currentScrollLeftPx =
        nextZoomScrollLeftRef.current ?? viewport?.scrollLeft ?? scrollLeftPx
      const nextContentWidthPx = getContentWidthPx(
        viewportWidthPx,
        clampedZoomFactor
      )
      const nextScrollLeftPx = getScrollLeftForZoom({
        currentScrollLeftPx,
        currentContentWidthPx: contentWidthPx,
        nextContentWidthPx,
        viewportWidthPx,
        currentTimeMs: displayTimeMs,
        timelineDurationMs,
      })

      nextZoomScrollLeftRef.current = nextScrollLeftPx
      setScrollLeftPx(nextScrollLeftPx)
      setZoomFactor(clampedZoomFactor)
    },
    [
      contentWidthPx,
      displayTimeMs,
      timelineDurationMs,
      zoomFactor,
      scrollLeftPx,
      viewportWidthPx,
    ]
  )

  const zoomToPercent = useCallback(
    (nextZoomPercent: number) => {
      zoomToFactor(getZoomFactorFromPercent(nextZoomPercent))
    },
    [zoomToFactor]
  )

  const handleZoomSliderChange = useCallback(
    (nextZoomPercent: number) => {
      zoomToPercent(nextZoomPercent)
    },
    [zoomToPercent]
  )

  const handlePlayheadPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      setIsDraggingPlayhead(true)

      const timeMs = getTimeAtPointerX(event.clientX)

      onScrubStart()
      onScrubChange(timeMs)
    },
    [getTimeAtPointerX, onScrubChange, onScrubStart]
  )

  const handlePlayheadPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        return
      }

      const timeMs = getTimeAtPointerX(event.clientX)
      onScrubChange(timeMs)
    },
    [getTimeAtPointerX, onScrubChange]
  )

  const handlePlayheadPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        return
      }

      const timeMs = getTimeAtPointerX(event.clientX)

      onScrubChange(timeMs)
      event.currentTarget.releasePointerCapture(event.pointerId)
      setIsDraggingPlayhead(false)
      onScrubEnd()
    },
    [getTimeAtPointerX, onScrubChange, onScrubEnd]
  )

  const handlePlayheadPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      setIsDraggingPlayhead(false)
      onScrubEnd()
    },
    [onScrubEnd]
  )

  useEffect(() => {
    if (!markerActivation) {
      return
    }

    const viewport = viewportRef.current

    if (!viewport || contentWidthPx <= 0) {
      return
    }

    const nextScrollLeftPx = getScrollLeftForMarker({
      currentScrollLeftPx: viewport.scrollLeft,
      viewportWidthPx: viewport.clientWidth,
      requestedTimeMs: markerActivation.requestedTimeMs,
      timelineDurationMs,
      contentWidthPx,
    })

    if (nextScrollLeftPx === undefined) {
      return
    }

    viewport.scrollLeft = nextScrollLeftPx
  }, [contentWidthPx, markerActivation, timelineDurationMs])

  return (
    <section className="col-span-2 flex flex-col rounded-2xl border border-zinc-200 bg-white p-8">
      <Toolbar
        currentTimeMs={displayTimeMs}
        zoomPercent={zoomPercent}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
        onZoomChange={handleZoomSliderChange}
        onZoomIn={() => zoomToPercent(zoomPercent + ZOOM_BUTTON_STEP)}
        onZoomOut={() => zoomToPercent(zoomPercent - ZOOM_BUTTON_STEP)}
      />

      <div className="relative mt-2 overflow-visible">
        <TimelineViewport
          viewportRef={viewportRef}
          contentWidthPx={contentWidthPx}
          timelineDurationMs={timelineDurationMs}
          markers={timelineMarkers}
          waveform={waveform}
          selectedMarkerId={selectedMarkerId}
          draggingMarkerId={markerDragState?.markerId}
          rulerScale={rulerScale}
          onMarkerDragStart={handleMarkerDragStart}
          onPointerCancel={handleViewportPointerCancel}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={handleViewportPointerUp}
          onScroll={handleViewportScroll}
        />

        <PlayheadOverlay
          contentWidthPx={contentWidthPx}
          currentTimeMs={displayTimeMs}
          scrollLeftPx={scrollLeftPx}
          timelineDurationMs={timelineDurationMs}
          isDragging={isDraggingPlayhead}
          onDragCancel={handlePlayheadPointerCancel}
          onDragStart={handlePlayheadPointerDown}
          onDragMove={handlePlayheadPointerMove}
          onDragEnd={handlePlayheadPointerUp}
        />
      </div>

      <TimelineScrollbar
        viewportWidthPx={viewportWidthPx}
        contentWidthPx={contentWidthPx}
        scrollLeftPx={scrollLeftPx}
        onScrollLeftChange={scrollViewportTo}
      />
    </section>
  )
}

const getContentWidthPx = (viewportWidthPx: number, zoomFactor: number) => {
  if (viewportWidthPx <= 0) {
    return 0
  }

  return Math.max(Math.round(viewportWidthPx * zoomFactor), viewportWidthPx)
}

const getZoomPercentFromFactor = (zoomFactor: number) => {
  if (MAX_ZOOM_FACTOR <= MIN_ZOOM_FACTOR) {
    return 100
  }

  const clampedZoomFactor = clampZoomFactor(zoomFactor)
  const zoomRange = Math.log(MAX_ZOOM_FACTOR / MIN_ZOOM_FACTOR)

  if (zoomRange <= 0) {
    return 0
  }

  return (
    (Math.log(clampedZoomFactor / MIN_ZOOM_FACTOR) / zoomRange) * 100
  )
}

const getZoomFactorFromPercent = (zoomPercent: number) => {
  if (MAX_ZOOM_FACTOR <= MIN_ZOOM_FACTOR) {
    return MIN_ZOOM_FACTOR
  }

  const clampedZoomPercent = clampZoomPercent(zoomPercent)
  const zoomRange = Math.log(MAX_ZOOM_FACTOR / MIN_ZOOM_FACTOR)

  return MIN_ZOOM_FACTOR * Math.exp((clampedZoomPercent / 100) * zoomRange)
}

const clampZoomFactor = (zoomFactor: number) => {
  return Math.max(MIN_ZOOM_FACTOR, Math.min(zoomFactor, MAX_ZOOM_FACTOR))
}

const clampZoomPercent = (zoomPercent: number) => {
  return Math.max(0, Math.min(zoomPercent, 100))
}

const getScrollLeftForZoom = ({
  currentScrollLeftPx,
  currentContentWidthPx,
  nextContentWidthPx,
  viewportWidthPx,
  currentTimeMs,
  timelineDurationMs,
}: {
  currentScrollLeftPx: number
  currentContentWidthPx: number
  nextContentWidthPx: number
  viewportWidthPx: number
  currentTimeMs: number
  timelineDurationMs: number
}) => {
  const currentPlayheadPx = timeToPx(
    currentTimeMs,
    timelineDurationMs,
    currentContentWidthPx
  )
  const playheadIsVisible =
    currentPlayheadPx >= currentScrollLeftPx &&
    currentPlayheadPx <= currentScrollLeftPx + viewportWidthPx

  if (playheadIsVisible) {
    const playheadOffsetPx = currentPlayheadPx - currentScrollLeftPx
    const nextPlayheadPx = timeToPx(
      currentTimeMs,
      timelineDurationMs,
      nextContentWidthPx
    )
    const maxScrollLeftPx = Math.max(nextContentWidthPx - viewportWidthPx, 0)

    return Math.max(
      0,
      Math.min(nextPlayheadPx - playheadOffsetPx, maxScrollLeftPx)
    )
  }

  const centerRatio =
    currentContentWidthPx > 0
      ? (currentScrollLeftPx + viewportWidthPx / 2) / currentContentWidthPx
      : 0
  const maxScrollLeftPx = Math.max(nextContentWidthPx - viewportWidthPx, 0)

  return Math.max(
    0,
    Math.min(
      centerRatio * nextContentWidthPx - viewportWidthPx / 2,
      maxScrollLeftPx
    )
  )
}

type TimelineViewportProps = {
  viewportRef: React.RefObject<HTMLDivElement | null>
  contentWidthPx: number
  timelineDurationMs: number
  markers: Marker[]
  waveform?: MediaWaveform
  selectedMarkerId?: string
  draggingMarkerId?: string
  rulerScale: RulerScale
  onMarkerDragStart: (
    event: React.PointerEvent<HTMLDivElement>,
    markerId: string
  ) => void
  onPointerCancel: () => void
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
  onScroll: () => void
}

const TimelineViewport = ({
  viewportRef,
  contentWidthPx,
  timelineDurationMs,
  markers,
  waveform,
  selectedMarkerId,
  draggingMarkerId,
  rulerScale,
  onMarkerDragStart,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onScroll,
}: TimelineViewportProps) => {
  return (
    <div
      ref={viewportRef}
      className="relative cursor-pointer overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onScroll={onScroll}
    >
      <div
        className="relative min-w-full"
        style={{
          width: contentWidthPx > 0 ? `${contentWidthPx}px` : undefined,
        }}
      >
        <Spacer className="h-8" />
        <Track
          contentWidthPx={contentWidthPx}
          markers={markers}
          timelineDurationMs={timelineDurationMs}
          waveform={waveform}
          selectedMarkerId={selectedMarkerId}
          draggingMarkerId={draggingMarkerId}
          onMarkerDragStart={onMarkerDragStart}
        />
        <Ruler
          timelineLengthMs={timelineDurationMs}
          contentWidthPx={contentWidthPx}
          markers={markers}
          rulerScale={rulerScale}
        />
      </div>
    </div>
  )
}

const getMarkerDragBounds = (
  markers: Marker[],
  markerId: string,
  timelineDurationMs: number
) => {
  const sortedMarkers = [...markers].sort(
    (leftMarker, rightMarker) =>
      leftMarker.requestedTimeMs - rightMarker.requestedTimeMs
  )
  const markerIndex = sortedMarkers.findIndex((marker) => marker.id === markerId)
  const previousMarker = markerIndex > 0 ? sortedMarkers[markerIndex - 1] : undefined
  const nextMarker =
    markerIndex >= 0 && markerIndex < sortedMarkers.length - 1
      ? sortedMarkers[markerIndex + 1]
      : undefined
  const maxTimelineStartMs = Math.max(timelineDurationMs - MARKER_DURATION_MS, 0)

  return {
    minRequestedTimeMs: previousMarker
      ? previousMarker.requestedTimeMs + MARKER_DURATION_MS
      : 0,
    maxRequestedTimeMs: Math.min(
      nextMarker
        ? nextMarker.requestedTimeMs - MARKER_DURATION_MS
        : maxTimelineStartMs,
      maxTimelineStartMs
    ),
  }
}

const clampMarkerRequestedTime = (
  requestedTimeMs: number,
  minRequestedTimeMs: number,
  maxRequestedTimeMs: number
) => {
  const clampedMaxRequestedTimeMs = Math.max(
    minRequestedTimeMs,
    maxRequestedTimeMs
  )

  return Math.max(
    minRequestedTimeMs,
    Math.min(Math.round(requestedTimeMs), clampedMaxRequestedTimeMs)
  )
}

const getScrollLeftForMarker = ({
  currentScrollLeftPx,
  viewportWidthPx,
  requestedTimeMs,
  timelineDurationMs,
  contentWidthPx,
}: {
  currentScrollLeftPx: number
  viewportWidthPx: number
  requestedTimeMs: number
  timelineDurationMs: number
  contentWidthPx: number
}) => {
  if (viewportWidthPx <= 0 || contentWidthPx <= 0) {
    return undefined
  }

  const markerStartPx = timeToPx(
    requestedTimeMs,
    timelineDurationMs,
    contentWidthPx
  )
  const markerEndPx = timeToPx(
    requestedTimeMs + MARKER_DURATION_MS,
    timelineDurationMs,
    contentWidthPx
  )
  const visibleStartPx = currentScrollLeftPx + VIEWPORT_FOLLOW_PADDING_PX
  const visibleEndPx =
    currentScrollLeftPx + viewportWidthPx - VIEWPORT_FOLLOW_PADDING_PX

  if (markerStartPx < visibleStartPx) {
    return Math.max(0, markerStartPx - VIEWPORT_FOLLOW_PADDING_PX)
  }

  if (markerEndPx > visibleEndPx) {
    return Math.max(
      0,
      markerEndPx + VIEWPORT_FOLLOW_PADDING_PX - viewportWidthPx
    )
  }

  return undefined
}

type PlayheadOverlayProps = {
  contentWidthPx: number
  currentTimeMs: number
  scrollLeftPx: number
  timelineDurationMs: number
  isDragging: boolean
  onDragStart: (event: React.PointerEvent<HTMLDivElement>) => void
  onDragMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onDragEnd: (event: React.PointerEvent<HTMLDivElement>) => void
  onDragCancel: (event: React.PointerEvent<HTMLDivElement>) => void
}

const PlayheadOverlay = ({
  contentWidthPx,
  currentTimeMs,
  scrollLeftPx,
  timelineDurationMs,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: PlayheadOverlayProps) => {
  return (
    <div
      className="pointer-events-none absolute overflow-hidden"
      style={{
        left: -PLAYHEAD_OVERFLOW_SIDE_PX,
        right: -PLAYHEAD_OVERFLOW_SIDE_PX,
        top: -PLAYHEAD_OVERFLOW_TOP_PX,
        height:
          HANDLE_ZONE_HEIGHT + TRACK_HEIGHT + PLAYHEAD_OVERFLOW_TOP_PX,
      }}
    >
      <div
        className="absolute left-0 min-w-full"
        style={{
          left: PLAYHEAD_OVERFLOW_SIDE_PX,
          top: PLAYHEAD_OVERFLOW_TOP_PX,
          height: HANDLE_ZONE_HEIGHT + TRACK_HEIGHT,
          width: contentWidthPx > 0 ? `${contentWidthPx}px` : undefined,
          transform: `translateX(${-scrollLeftPx}px)`,
        }}
      >
        <Playhead
          currentTimeMs={currentTimeMs}
          timelineLengthMs={timelineDurationMs}
          contentWidthPx={contentWidthPx}
          trackTopOffset={HANDLE_ZONE_HEIGHT}
          trackHeight={TRACK_HEIGHT}
          isDragging={isDragging}
          onDragCancel={onDragCancel}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      </div>
    </div>
  )
}
