import { Container, getContainer } from "@cloudflare/containers"

type Env = {
  APP?: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
  }
  APP_INTERNAL_BASE_URL?: string
  MP4_EXPORTER: unknown
  TRANSCODER_AUTH_TOKEN?: string
}

const INSTANCE_NAME = "mp4-exporter-v2"
const APP_BINDING_ORIGIN = "https://app.internal"

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  })

const isAuthorized = (request: Request, token?: string) => {
  if (!token) {
    return true
  }

  return request.headers.get("authorization") === `Bearer ${token}`
}

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "")

const fetchApp = (env: Env, path: string, init?: RequestInit) => {
  if (env.APP) {
    return env.APP.fetch(new URL(path, APP_BINDING_ORIGIN), init)
  }

  /* For local/dev preview */
  if (env.APP_INTERNAL_BASE_URL) {
    return fetch(`${trimTrailingSlash(env.APP_INTERNAL_BASE_URL)}${path}`, init)
  }

  throw new Error("App callback target is missing: Confirm `env.APP` or `APP_INTERNAL_BASE_URL` env var is set.")
}

const forwardMp4Progress = async (request: Request, env: Env) => {
  const body = await request.text()
  const contentType = request.headers.get("content-type") || "application/json"
  const authorization = request.headers.get("authorization")
  const response = await fetchApp(env, "/api/worker/mp4-export-jobs", {
    method: "POST",
    headers: {
      authorization: authorization ?? "",
      "content-type": contentType,
    },
    body,
  })
  const text = await response.text()

  return new Response(text, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") || "application/json",
    },
  })
}

export class Mp4Exporter extends Container {
  defaultPort = 3000
  sleepAfter = "10m"
  pingEndpoint = "localhost/health"
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)

    if (request.method === "GET" && url.pathname === "/health") {

      return jsonResponse({ ok: true })
    }

    if (request.method === "POST" && url.pathname === "/transcripts/chunk") {

      if (!isAuthorized(request, env.TRANSCODER_AUTH_TOKEN)) {
        return jsonResponse({ error: "Unauthorized" }, { status: 401 })
      }

      return getContainer(env.MP4_EXPORTER, INSTANCE_NAME).fetch(request)
    }

    if (request.method === "POST" && url.pathname === "/waveforms") {

      if (!isAuthorized(request, env.TRANSCODER_AUTH_TOKEN)) {
        return jsonResponse({ error: "Unauthorized" }, { status: 401 })
      }

      return getContainer(env.MP4_EXPORTER, INSTANCE_NAME).fetch(request)
    }

    if (request.method === "POST" && url.pathname === "/exports/mp4") {

      if (!isAuthorized(request, env.TRANSCODER_AUTH_TOKEN)) {
        return jsonResponse({ error: "Unauthorized" }, { status: 401 })
      }

      return getContainer(env.MP4_EXPORTER, INSTANCE_NAME).fetch(request)
    }

    if (request.method === "POST" && url.pathname === "/exports/mp4/progress") {

      try {
        return await forwardMp4Progress(request, env)

      } catch (error) {

        const message = error instanceof Error ? error.message : "Unable to forward MP4 progress."

        console.error("UNable to forward MP4 progress update.", error)
        return jsonResponse({ error: message }, { status: 502 })
      }
    }

    return jsonResponse({ error: "Not found" }, { status: 404 })
  },
}
