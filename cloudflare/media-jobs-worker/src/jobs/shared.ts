type AppServiceBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

export type AppJobEnv = {
  APP?: AppServiceBinding
  APP_INTERNAL_BASE_URL: string
  MEDIA_JOBS_TOKEN: string
  TRANSCODER_URL: string
  TRANSCODER_AUTH_TOKEN: string
}

const APP_BINDING_ORIGIN = "https://app.internal"

export const trimTrailingSlash = (value: string) => value.replace(/\/$/, "")

export const fetchApp = (
  env: Pick<AppJobEnv, "APP" | "APP_INTERNAL_BASE_URL">,
  path: string,
  init?: RequestInit
) => {
  if (env.APP) {
    return env.APP.fetch(new URL(path, APP_BINDING_ORIGIN), init)
  }

  return fetch(`${trimTrailingSlash(env.APP_INTERNAL_BASE_URL)}${path}`, init)
}

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
