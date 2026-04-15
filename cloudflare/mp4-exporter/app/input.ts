export const readRequiredString = (value: unknown, message: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message)
  }

  return value.trim()
}

export const readUrl = (value: unknown, message: string) => {
  const url = readRequiredString(value, message)
  const parsed = new URL(url)

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(message)
  }

  return url
}

export const readPositiveInt = (value: unknown, message: string) => {
  const number = Number(value)

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(message)
  }

  return Math.round(number)
}

export const readNonNegativeInt = (value: unknown, message: string) => {
  const number = Number(value)

  if (!Number.isFinite(number) || number < 0) {
    throw new Error(message)
  }

  return Math.round(number)
}

export const readOptionalDurationMs = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined
  }

  return readPositiveInt(value, "durationMs must be a positive number")
}
