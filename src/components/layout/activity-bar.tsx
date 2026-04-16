"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { AnimatePresence, motion } from "motion/react"

const BAR_HEIGHT_PX = 2
const PAUSE_BEFORE_HIDE_MS = 400

const SHIMMER_ANIMATE = { x: ["-100%", "300%"] }
const SHIMMER_TRANSITION = {
  duration: 1.4,
  ease: "easeInOut" as const,
  repeat: Infinity,
}
const FILL_TRANSITION = { duration: 0.3, ease: "easeOut" as const }
const FADE_TRANSITION = { duration: 0.2 }

type ActivityStore = {
  entries: Map<string, number | undefined>
  report: (id: string, percent: number | undefined) => void
  clear: (id: string) => void
}

const ActivityBarContext = createContext<ActivityStore | null>(null)

export const ActivityBarProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [entries, setEntries] = useState<Map<string, number | undefined>>( () => new Map())

  const report = useCallback((id: string, percent: number | undefined) => {
    setEntries((previous) => {
      if (previous.has(id) && previous.get(id) === percent) {
        return previous
      }
      const next = new Map(previous)
      next.set(id, percent)
      return next
    })
  }, [])

  const clear = useCallback((id: string) => {
    setEntries((previous) => {
      if (!previous.has(id)) {
        return previous
      }
      const next = new Map(previous)
      next.delete(id)
      return next
    })
  }, [])

  const store = useMemo(
    () => ({ entries, report, clear }),
    [entries, report, clear]
  )

  return (
    <ActivityBarContext.Provider value={store}>
      {children}
    </ActivityBarContext.Provider>
  )
}

const useActivityStore = () => {
  const store = useContext(ActivityBarContext)
  if (!store) {
    throw new Error("ActivityBarProvider is missing")
  }
  return store
}

export const useActivityBar = () => {
  const { report, clear } = useActivityStore()
  return useMemo(() => ({ report, clear }), [report, clear])
}

const aggregateEntries = (
  entries: Map<string, number | undefined>
) => {
  if (entries.size === 0) {
    return { isActive: false, percent: undefined as number | undefined }
  }
  const values = Array.from(entries.values())
  if (values.some((value) => value === undefined)) {
    return { isActive: true, percent: undefined as number | undefined }
  }
  const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  return { isActive: true, percent: total / values.length }
}

export const ActivityBar = () => {
  const { entries } = useActivityStore()
  const { isActive, percent } = useMemo(
    () => aggregateEntries(entries),
    [entries]
  )

  const [isVisible, setIsVisible] = useState(false)
  const [displayPercent, setDisplayPercent] = useState(0)
  const [isShimmering, setIsShimmering] = useState(true)

  useEffect(() => {
    if (isActive) {
      setIsVisible(true)
      if (percent === undefined) {
        setIsShimmering(true)
      } else {
        setIsShimmering(false)
        setDisplayPercent(percent)
      }
      return
    }
    setIsShimmering(false)
    setDisplayPercent(100)
    const timeoutId = window.setTimeout(
      () => setIsVisible(false),
      PAUSE_BEFORE_HIDE_MS
    )
    return () => window.clearTimeout(timeoutId)
  }, [isActive, percent])

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          key="activity-bar"
          className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
          style={{ height: BAR_HEIGHT_PX }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FADE_TRANSITION}
        >
          <motion.div
            className="absolute inset-0 origin-left bg-zinc-900"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{
              scaleX: displayPercent / 100,
              opacity: isShimmering ? 0 : 1,
            }}
            transition={FILL_TRANSITION}
          />
          <motion.div
            className="absolute inset-y-0 left-0 w-1/3"
            animate={SHIMMER_ANIMATE}
            transition={SHIMMER_TRANSITION}
          >
            <motion.div
              className="h-full w-full bg-zinc-900"
              initial={{ opacity: 0 }}
              animate={{ opacity: isShimmering ? 1 : 0 }}
              transition={FADE_TRANSITION}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
