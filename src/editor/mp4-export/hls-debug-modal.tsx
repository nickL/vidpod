"use client"

import { type ReactNode, useEffect, useState } from "react"
import Hls, { type ErrorData } from "hls.js"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const HLS_JS_SUPPORTED = Hls.isSupported()

type HLSDebugModalProps = {
  open: boolean
  manifestUrl?: string
  isLoading: boolean
  error?: string
  onOpenChange: (open: boolean) => void
}

const resetVideo = (video: HTMLVideoElement) => {
  video.pause()
  video.removeAttribute("src")
  video.load()
}

const MessagePanel = ({
  children,
  tone = "default",
}: {
  children: ReactNode
  tone?: "default" | "error"
}) => (
  <div
    className={cn(
      "flex min-h-72 items-center justify-center rounded-2xl bg-zinc-950 px-8 text-center text-sm sm:min-h-96",
      tone === "error" ? "text-red-300" : "text-zinc-300"
    )}
  >
    {children}
  </div>
)

export const HLSDebugModal = ({
  open,
  manifestUrl,
  isLoading,
  error,
  onOpenChange,
}: HLSDebugModalProps) => {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string>()
  const [playerError, setPlayerError] = useState<{
    manifestUrl: string
    message: string
  }>()

  const supportsNativeHls = !!videoElement?.canPlayType("application/vnd.apple.mpegurl")
  const supportsPlayback = !videoElement || HLS_JS_SUPPORTED || supportsNativeHls
  const playbackError =
    playerError && manifestUrl && playerError.manifestUrl === manifestUrl
      ? playerError.message
      : undefined
  const copied = !!(manifestUrl && copiedUrl === manifestUrl)

  const getDisplayError = () => {
    if (error) return error
    if (!manifestUrl) return "HLS preview is not available."
    if (!supportsPlayback) return "Browser unable to play HLS stream."
    return playbackError
  }
  const displayError = getDisplayError()

  useEffect(() => {
    if (!open) {
      return
    }

    if (!videoElement || !manifestUrl) {
      return
    }

    if (HLS_JS_SUPPORTED) {
      const hls = new Hls({
        enableInterstitialPlayback: true,
      })

      hls.loadSource(manifestUrl)
      hls.attachMedia(videoElement)
      hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
        if (data.fatal) {
          setPlayerError({
            manifestUrl,
            message: "Unable to play HLS preview.",
          })
        }
      })

      return () => {
        hls.destroy()
        resetVideo(videoElement)
      }
    }

    if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
      videoElement.src = manifestUrl
      videoElement.load()

      return () => {
        resetVideo(videoElement)
      }
    }
  }, [manifestUrl, open, videoElement])

  const copyManifest = async () => {
    if (!manifestUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(manifestUrl)
      setCopiedUrl(manifestUrl)
    } catch {
      setCopiedUrl(undefined)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(820px,calc(100vh-3rem))] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden border border-zinc-100 bg-white p-0 sm:max-w-4xl"
      >
        <DialogHeader className="px-6 pt-8 pb-5">
          <DialogTitle>HLS output preview</DialogTitle>
          <DialogDescription>
            Preview of generated HLS stream + ad interstitials
          </DialogDescription>
        </DialogHeader>
        <div className="mx-6 border-t border-zinc-200" />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-5 pb-6">
          {manifestUrl ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2">
              <div className="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 font-mono text-xs text-zinc-600">
                <p className="truncate">{manifestUrl}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void copyManifest()}>
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          ) : null}
          {isLoading ? (
            <MessagePanel>Preparing HLS preview…</MessagePanel>
          ) : displayError ? (
            <MessagePanel tone="error">{displayError}</MessagePanel>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-zinc-950">
              <video
                ref={setVideoElement}
                className="block w-full max-h-[min(60vh,34rem)] bg-black"
                controls
                playsInline
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
