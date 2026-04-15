import { Container, getContainer } from "@cloudflare/containers"

type Env = {
  MP4_EXPORTER: unknown
  TRANSCODER_AUTH_TOKEN?: string
}

const INSTANCE_NAME = "mp4-exporter-v2"

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

    return jsonResponse({ error: "Not found" }, { status: 404 })
  },
}
