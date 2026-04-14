export const secondsToMs = (seconds: number) => {
  return Math.round(seconds * 1000)
}

export const msToSeconds = (ms: number) => {
  return ms / 1000
}

export const clampTimeMs = (timeMs: number, durationMs?: number) => {
  const normalizedTimeMs = Math.max(0, Math.round(timeMs))

  if (!durationMs || durationMs <= 0) {
    return normalizedTimeMs
  }

  return Math.min(normalizedTimeMs, durationMs)
}
