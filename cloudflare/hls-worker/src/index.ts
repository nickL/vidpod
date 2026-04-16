type Env = {
  APP?: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
  }
  MEDIA_JOBS_TOKEN: string
  APP_INTERNAL_BASE_URL: string
}

type Plan = {
  episode: {
    playbackUrl: string
  }
  resolvedBreaks: Array<{
    adBreakId: string
    requestedTimeMs: number
    selectedVariant: {
      mediaAsset: {
        playbackUrl: string
      }
    }
  }>
}

type ResolvedBreak = Plan["resolvedBreaks"][number]

const HLS_INTERSTITIAL_CLASS = "com.apple.hls.interstitial"
const FALLBACK_PROGRAM_DATE_TIME = "1970-01-01T00:00:00.000Z"
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
}
const APP_BINDING_ORIGIN = "https://app.internal"

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "")

const fetchApp = (env: Env, path: string, init?: RequestInit) => {
  if (env.APP) {
    return env.APP.fetch(new URL(path, APP_BINDING_ORIGIN), init)
  }

  return fetch(`${trimTrailingSlash(env.APP_INTERNAL_BASE_URL)}${path}`, init)
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  })

const m3u8 = (body: string) =>
  new Response(body, {
    headers: {
      "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
      "cache-control": "no-store",
      ...CORS_HEADERS,
    },
  })

const loadHlsPlan = async (env: Env, sessionId: string): Promise<Plan> => {
  const response = await fetchApp(
    env,
    `/api/worker/hls/sessions/${sessionId}/manifest-plan`,
    {
      headers: {
        authorization: `Bearer ${env.MEDIA_JOBS_TOKEN}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Unable to load manifest plan: ${response.status}`)
  }

  return response.json() as Promise<Plan>
}

const getBaseUrl = (url: string) => new URL(".", url).toString()
const isPlaylistPathLine = (line: string) =>
  line.trim().length > 0 && !line.startsWith("#")
const isEpisodePlaylistUrl = (playlistUrl: string, episodeManifestUrl: string) =>
  playlistUrl.startsWith(getBaseUrl(episodeManifestUrl))

const buildMediaPlaylistPath = (sessionId: string, originUrl: string) =>
  `/sessions/${sessionId}/media.m3u8?origin=${encodeURIComponent(originUrl)}`

const rewriteQuotedUris = (line: string, resolveUrl: (uri: string) => string) =>
  line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
    return `URI="${resolveUrl(uri)}"`
  })

const getSegmentDurationMs = (line: string) => {
  const match = line.match(/^#EXTINF:([0-9.]+)/)
  const seconds = Number.parseFloat(match?.[1] ?? "0")

  return Number.isFinite(seconds) && seconds > 0
    ? Math.round(seconds * 1000)
    : 0
}

const getBreakStartDate = (lines: string[], requestedTimeMs: number) => {
  const line = lines.find((value) => value.startsWith("#EXT-X-PROGRAM-DATE-TIME:"))
  const anchorMs = line
    ? Date.parse(line.replace("#EXT-X-PROGRAM-DATE-TIME:", ""))
    : Date.parse(FALLBACK_PROGRAM_DATE_TIME)

  return new Date(
    (Number.isFinite(anchorMs)
      ? anchorMs
      : Date.parse(FALLBACK_PROGRAM_DATE_TIME)) +
      requestedTimeMs
  ).toISOString()
}

const buildInterstitialDateRange = (
  playbackBreak: ResolvedBreak,
  lines: string[]
) => {
  return [
    `#EXT-X-DATERANGE:ID="${playbackBreak.adBreakId}"`,
    `CLASS="${HLS_INTERSTITIAL_CLASS}"`,
    `START-DATE="${getBreakStartDate(lines, playbackBreak.requestedTimeMs)}"`,
    `X-ASSET-URI="${playbackBreak.selectedVariant.mediaAsset.playbackUrl}"`,
  ].join(",")
}

const getInterstitials = (plan: Plan, lines: string[]) => {
  return [...plan.resolvedBreaks]
    .sort((left, right) => left.requestedTimeMs - right.requestedTimeMs)
    .map((playbackBreak) => ({
      requestedTimeMs: playbackBreak.requestedTimeMs,
      line: buildInterstitialDateRange(playbackBreak, lines),
    }))
}

const rewriteMasterPlaylist = (
  manifest: string,
  sessionId: string,
  masterUrl: string
) => {
  const playlistBase = getBaseUrl(masterUrl)

  return manifest
    .split(/\r?\n/)
    .map((line) => {
      if (!line) return line
      if (line.includes('URI="')) {
        return rewriteQuotedUris(line, (uri) =>
          buildMediaPlaylistPath(sessionId, new URL(uri, playlistBase).toString())
        )
      }
      if (line.startsWith("#")) return line
      return buildMediaPlaylistPath(
        sessionId,
        new URL(line, playlistBase).toString()
      )
    })
    .join("\n")
}

const rewriteMediaPlaylist = (manifest: string, plan: Plan, mediaUrl: string) => {
  const lines = manifest.split(/\r?\n/)
  const playlistBase = getBaseUrl(mediaUrl)
  const interstitials = getInterstitials(plan, lines)
  const needsStart = !lines.some((line) =>
    line.startsWith("#EXT-X-PROGRAM-DATE-TIME:")
  )
  const out: string[] = []
  let segmentStartMs = 0
  let segmentDurationMs = 0
  let interstitialIndex = 0

  for (const line of lines) {
    out.push(line)

    if (needsStart && line === "#EXTM3U") {
      out.push(`#EXT-X-PROGRAM-DATE-TIME:${FALLBACK_PROGRAM_DATE_TIME}`)
      continue
    }

    if (line.startsWith("#EXTINF:")) {
      segmentDurationMs = getSegmentDurationMs(line)

      while (interstitialIndex < interstitials.length) {
        const nextInterstitial = interstitials[interstitialIndex]

        if (nextInterstitial.requestedTimeMs < segmentStartMs) {
          interstitialIndex += 1
          continue
        }

        if (nextInterstitial.requestedTimeMs >= segmentStartMs + segmentDurationMs) {
          break
        }

        out.splice(out.length - 1, 0, nextInterstitial.line)
        interstitialIndex += 1
      }

      continue
    }

    if (line.includes('URI="')) {
      out[out.length - 1] = rewriteQuotedUris(line, (uri) =>
        new URL(uri, playlistBase).toString()
      )
      continue
    }

    if (isPlaylistPathLine(line)) {
      out[out.length - 1] = new URL(line, playlistBase).toString()
      segmentStartMs += segmentDurationMs
      segmentDurationMs = 0
    }
  }

  if (interstitialIndex < interstitials.length) {
    const remainingInterstitials = interstitials
      .slice(interstitialIndex)
      .map((interstitial) => interstitial.line)
    const endIndex = out.findIndex((line) => line === "#EXT-X-ENDLIST")

    if (endIndex >= 0) {
      out.splice(endIndex, 0, ...remainingInterstitials)
    } else {
      out.push(...remainingInterstitials)
    }
  }

  return out.join("\n")
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      })
    }

    const url = new URL(request.url)
    const path = url.pathname

    if (path === "/health") {
      return json({ ok: true })
    }

    const masterMatch = path.match(/^\/sessions\/([^/]+)\/master\.m3u8$/)

    if (masterMatch) {
      const sessionId = masterMatch[1]
      const plan = await loadHlsPlan(env, sessionId)
      const origin = await fetch(plan.episode.playbackUrl)

      if (!origin.ok) {
        return json({ error: "Unable to load origin master manifest." }, 502)
      }

      return m3u8(
        rewriteMasterPlaylist(
          await origin.text(),
          sessionId,
          plan.episode.playbackUrl
        )
      )
    }

    const mediaMatch = path.match(/^\/sessions\/([^/]+)\/media\.m3u8$/)

    if (mediaMatch) {
      const sessionId = mediaMatch[1]
      const originUrl = url.searchParams.get("origin")

      if (!originUrl) {
        return json({ error: "Missing origin playlist URL." }, 400)
      }

      const plan = await loadHlsPlan(env, sessionId)

      if (!isEpisodePlaylistUrl(originUrl, plan.episode.playbackUrl)) {
        return json({ error: "Origin playlist is outside the episode manifest." }, 400)
      }

      const origin = await fetch(originUrl)

      if (!origin.ok) {
        return json({ error: "Unable to load origin media playlist." }, 502)
      }

      return m3u8(rewriteMediaPlaylist(await origin.text(), plan, originUrl))
    }

    return json({ error: "Not found" }, 404)
  },
}
