export type AppJobEnv = {
  APP_INTERNAL_BASE_URL: string
  MEDIA_JOBS_TOKEN: string
  TRANSCODER_URL: string
  TRANSCODER_AUTH_TOKEN: string
}

export const trimTrailingSlash = (value: string) => value.replace(/\/$/, "")

export const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  return error instanceof Error && error.message
    ? error.message
    : fallbackMessage
}

export const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  })
