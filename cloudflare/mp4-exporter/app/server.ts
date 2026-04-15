import { createServer } from "node:http"

import { generateMp4Export } from "./exports.js"
import { extractTranscriptChunkAudio } from "./transcripts.js"
import { generateWaveform } from "./waveforms.js"

const port = Number(process.env.PORT ?? 3000)

const json = (body: unknown, init?: { status?: number }) =>
  new Response(JSON.stringify(body), {
    status: init?.status,
    headers: {
      "content-type": "application/json",
    },
  })

const readObjectBody = async (request: Request) => {
  const body = await request.json().catch(() => null)
  return body && typeof body === "object"
    ? (body as Record<string, unknown>)
    : undefined
}

const readRequestBody = async (request: import("node:http").IncomingMessage) => {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return undefined
  }

  return Buffer.concat(chunks)
}

const server = createServer(async (incomingRequest, outgoingResponse) => {
  const requestUrl = new URL(
    incomingRequest.url || "/",
    `http://${incomingRequest.headers.host || "localhost"}`
  )
  const requestBody =
    incomingRequest.method === "GET" || incomingRequest.method === "HEAD"
      ? undefined
      : await readRequestBody(incomingRequest)
  const request = new Request(requestUrl, {
    method: incomingRequest.method,
    headers: incomingRequest.headers as HeadersInit,
    body: requestBody,
  })

  let response: Response

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    response = json({ ok: true })
  } else if (request.method === "GET" && requestUrl.pathname === "/ping") {
    response = new Response("ok")
  } else if (request.method === "POST" && requestUrl.pathname === "/waveforms") {
    const body = await readObjectBody(request)

    if (!body) {
      response = json({ error: "Invalid body." }, { status: 400 })
    } else {
      const sourceUrl =
        typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : ""
      const bucketCount =
        typeof body.bucketCount === "number" ? body.bucketCount : undefined

      if (!sourceUrl) {
        response = json({ error: "sourceUrl is required" }, { status: 400 })
      } else {
      try {
          response = json(
            await generateWaveform({
              sourceUrl,
              bucketCount,
            })
          )
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Couldn't generate the waveform."

        console.error("Couldn't generate the waveform.", error)
        response = json({ error: message }, { status: 422 })
      }
      }
    }
  } else if (request.method === "POST" && requestUrl.pathname === "/transcripts/chunk") {
    const body = await readObjectBody(request)

    if (!body) {
      response = json({ error: "Invalid body." }, { status: 400 })
    } else {
      try {
        const chunk = await extractTranscriptChunkAudio({
          audioUrl: body.audioUrl,
          durationMs: body.durationMs,
          startMs: body.startMs,
        })

        response = new Response(new Uint8Array(chunk.body), {
          headers: {
            "content-type": chunk.contentType,
          },
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Couldn't extract transcript audio."

        console.error("Couldn't extract transcript audio.", error)
        response = json({ error: message }, { status: 422 })
      }
    }
  } else if (request.method === "POST" && requestUrl.pathname === "/exports/mp4") {
    const body = await readObjectBody(request)

    if (!body) {
      response = json({ error: "Invalid body." }, { status: 400 })
    } else {
      try {
        const exportResult = await generateMp4Export({
          artifact: body.artifact,
          plan: body.plan,
          progressCallback: body.progressCallback,
        })

        response = json(exportResult)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Couldn't export the MP4."

        console.error("Couldn't export the MP4.", error)
        response = json({ error: message }, { status: 422 })
      }
    }
  } else {
    response = json({ error: "Not found" }, { status: 404 })
  }

  outgoingResponse.statusCode = response.status

  response.headers.forEach((value, key) => {
    outgoingResponse.setHeader(key, value)
  })

  if (!response.body) {
    outgoingResponse.end()
    return
  }

  const reader = response.body.getReader()

  const pump = async (): Promise<void> => {
    const { done, value } = await reader.read()

    if (done) {
      outgoingResponse.end()
      return
    }

    outgoingResponse.write(Buffer.from(value))
    await pump()
  }

  await pump()
})

server.listen(port, () => {
  console.log(`vidpod mp4 exporter listening on http://localhost:${port}`)
})
