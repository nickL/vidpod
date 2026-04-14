import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

const defaultDateFormat: Intl.DateTimeFormatOptions  = {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}

export const cn = (...inputs: ClassValue[]) =>  twMerge(clsx(inputs));

export const capitalize = (value: string) => {
  const text = value.trim()

  if (!text) {
    return ""
  }

  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const formatTimecode = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, "0"))
    .join(":")
}

export const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`
}

export const formatDate = (
  value?: string | Date,
  config: Intl.DateTimeFormatOptions = {}
) => {
  if (!value) {
    return ""
  }
  return new Intl.DateTimeFormat("en-GB", {
    ...defaultDateFormat,
    ...config,
  }).format(new Date(value))
}
