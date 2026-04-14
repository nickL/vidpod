"use client"

import { useEffect, useRef, useState } from "react"

const SCROLLBAR_THUMB_MIN_WIDTH_PX = 48

export type TimelineScrollbarProps = {
  viewportWidthPx: number
  contentWidthPx: number
  scrollLeftPx: number
  onScrollLeftChange: (scrollLeftPx: number) => void
}

export const TimelineScrollbar = ({
  viewportWidthPx,
  contentWidthPx,
  scrollLeftPx,
  onScrollLeftChange,
}: TimelineScrollbarProps) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbPointerOffsetPxRef = useRef(0)
  const [trackWidthPx, setTrackWidthPx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const maxScrollLeftPx = Math.max(contentWidthPx - viewportWidthPx, 0)

  useEffect(() => {
    const track = trackRef.current

    if (!track) {
      return
    }

    const updateTrackWidth = () => {
      setTrackWidthPx(track.clientWidth)
    }

    updateTrackWidth()

    const observer = new ResizeObserver(() => {
      updateTrackWidth()
    })

    observer.observe(track)

    return () => {
      observer.disconnect()
    }
  }, [])

  const getThumbLayout = (trackWidthPx: number) => {
    if (
      trackWidthPx <= 0 ||
      contentWidthPx <= 0 ||
      viewportWidthPx <= 0 ||
      maxScrollLeftPx === 0
    ) {
      return {
        thumbLeftPx: 0,
        thumbWidthPx: trackWidthPx,
      }
    }

    const thumbWidthPx = Math.max(
      Math.min(
        trackWidthPx,
        Math.max(
          (viewportWidthPx / contentWidthPx) * trackWidthPx,
          SCROLLBAR_THUMB_MIN_WIDTH_PX
        )
      )
    )
    const maxThumbLeftPx = trackWidthPx - thumbWidthPx
    const scrollRatio = scrollLeftPx / maxScrollLeftPx

    return {
      thumbLeftPx: scrollRatio * maxThumbLeftPx,
      thumbWidthPx,
    }
  }

  const getScrollLeftForThumb = (
    thumbLeftPx: number,
    trackWidthPx: number,
    thumbWidthPx: number
  ) => {
    const maxThumbLeftPx = Math.max(trackWidthPx - thumbWidthPx, 0)

    if (maxThumbLeftPx === 0 || maxScrollLeftPx === 0) {
      return 0
    }

    return (thumbLeftPx / maxThumbLeftPx) * maxScrollLeftPx
  }

  const handleTrackClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const { thumbWidthPx } = getThumbLayout(rect.width)
    const nextThumbLeftPx = Math.max(
      0,
      Math.min(
        event.clientX - rect.left - thumbWidthPx / 2,
        rect.width - thumbWidthPx
      )
    )

    onScrollLeftChange(
      getScrollLeftForThumb(nextThumbLeftPx, rect.width, thumbWidthPx)
    )
  }

  const handleThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current

    if (!track) {
      return
    }

    const rect = track.getBoundingClientRect()
    const { thumbLeftPx } = getThumbLayout(rect.width)

    thumbPointerOffsetPxRef.current = event.clientX - rect.left - thumbLeftPx
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const handleThumbPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return
    }

    const track = trackRef.current

    if (!track) {
      return
    }

    const rect = track.getBoundingClientRect()
    const { thumbWidthPx } = getThumbLayout(rect.width)
    const nextThumbLeftPx = Math.max(
      0,
      Math.min(
        event.clientX - rect.left - thumbPointerOffsetPxRef.current,
        rect.width - thumbWidthPx
      )
    )

    onScrollLeftChange(
      getScrollLeftForThumb(nextThumbLeftPx, rect.width, thumbWidthPx)
    )
  }

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    setIsDragging(false)
  }

  const { thumbLeftPx, thumbWidthPx } = getThumbLayout(trackWidthPx)
  const thumbStyle = {
    transform: `translateX(${thumbLeftPx}px)`,
    width: thumbWidthPx > 0 ? `${thumbWidthPx}px` : "100%",
  }

  return (
    <div
      ref={trackRef}
      className="relative mt-8 h-2 rounded-full bg-zinc-100"
      onClick={handleTrackClick}
    >
      <div
        className={`absolute left-0 top-0 h-full rounded-full bg-zinc-200 touch-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={thumbStyle}
        onPointerCancel={stopDragging}
        onPointerDown={handleThumbPointerDown}
        onPointerMove={handleThumbPointerMove}
        onPointerUp={stopDragging}
      />
    </div>
  )
}
