"use client"

import { useEffect, useRef, useState } from "react"

export const useIsScrolled = (thresholdPx = 0) => {
  const pageTopRef = useRef<HTMLDivElement>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const pageTop = pageTopRef.current
    if (!pageTop) return

    const observer = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { rootMargin: `-${thresholdPx}px 0px 0px 0px` }
    )
    observer.observe(pageTop)
    return () => observer.disconnect()
  }, [thresholdPx])

  return { pageTopRef, isScrolled }
}
