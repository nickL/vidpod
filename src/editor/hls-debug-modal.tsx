"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"
import Hls, { type ErrorData } from "hls.js"
import { Check, Copy, Download, LoaderCircle, TriangleAlert } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type HLSDebugModalProps = {
  open: boolean
  manifestUrl?: string
  isLoading: boolean
  isGeneratingMp4: boolean
  downloadUrl?: string
  downloadError?: string
  error?: string
  onGenerateMp4: () => void | Promise<void>
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

const StatusCard = ({
  icon,
  tone = "default",
  title,
  action,
  children,
}: {
  icon: ReactNode
  tone?: "default" | "success" | "error"
  title: string
  action?: ReactNode
  children: ReactNode
}) => {
  const styles = {
    default: {
      card: "border-zinc-200 bg-zinc-50",
      icon: "text-zinc-700 ring-zinc-200",
      text: "text-zinc-600",
      title: "text-zinc-950",
    },
    success: {
      card: "border-emerald-200 bg-emerald-50",
      icon: "text-emerald-700 ring-emerald-200",
      text: "text-emerald-800",
      title: "text-emerald-950",
    },
    error: {
      card: "border-red-200 bg-red-50",
      icon: "text-red-700 ring-red-200",
      text: "text-red-800",
      title: "text-red-950",
    },
  }[tone]

  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3", styles.card)}>
      <div className={cn("mt-0.5 rounded-full bg-white p-2 ring-1", styles.icon)}>
        {icon}
      </div>
      <div className="min-w-0 space-y-1">
        <p className={cn("text-sm font-semibold", styles.title)}>{title}</p>
        <p className={cn("text-sm leading-5", styles.text)}>{children}</p>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  )
}

export const HLSDebugModal = ({
  open,
  manifestUrl,
  isLoading,
  isGeneratingMp4,
  downloadUrl,
  downloadError,
  error,
  onGenerateMp4,
  onOpenChange,
}: HLSDebugModalProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string>()
  const [playerError, setPlayerError] = useState<{
    manifestUrl: string
    message: string
  }>()

  const supportsNativeHls = Boolean(
    videoElement?.canPlayType("application/vnd.apple.mpegurl")
  )
  const supportsHlsJs = Hls.isSupported()
  const supportsPlayback = !videoElement || supportsHlsJs || supportsNativeHls
  const playbackError =
    playerError && manifestUrl && playerError.manifestUrl === manifestUrl
      ? playerError.message
      : undefined
  const copied = Boolean(manifestUrl && copiedUrl === manifestUrl)
  const displayError =
    error ??
    (!manifestUrl
      ? "HLS preview is not available."
      : !supportsPlayback
        ? "Browser unable to play HLS stream."
        : playbackError)

  useEffect(() => {
    if (!open) {
      return
    }

    const video = videoRef.current
    if (!video || !manifestUrl) {
      return
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableInterstitialPlayback: true,
      })

      hls.loadSource(manifestUrl)
      hls.attachMedia(video)
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
        resetVideo(video)
      }
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = manifestUrl
      video.load()

      return () => {
        resetVideo(video)
      }
    }
  }, [manifestUrl, open])

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
              {downloadUrl ? null : (
                <Button
                  size="sm"
                  disabled={isLoading || isGeneratingMp4}
                  onClick={() => void onGenerateMp4()}
                >
                  {isGeneratingMp4 ? "Generating MP4…" : "Generate MP4"}
                </Button>
              )}
            </div>
          ) : null}
          {isGeneratingMp4 ? (
            <StatusCard
              icon={<LoaderCircle className="size-4 animate-spin" />}
              title="Generating MP4"
            >
              Stitching up the episode and inserted ads on the server...
              Download link will show here when ready.
            </StatusCard>
          ) : downloadUrl ? (
            <StatusCard
              icon={<Download className="size-4" />}
              tone="success"
              title="MP4 ready"
              action={
                <a
                  href={downloadUrl}
                  download
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  Download MP4
                </a>
              }
            >
              The stitched export for this preview session is ready to
              download.
            </StatusCard>
          ) : downloadError ? (
            <StatusCard
              icon={<TriangleAlert className="size-4" />}
              tone="error"
              title="Uh oh - Error generating MP4."
            >
              {downloadError}
            </StatusCard>
          ) : null}
          {isLoading ? (
            <MessagePanel>Preparing HLS preview…</MessagePanel>
          ) : displayError ? (
            <MessagePanel tone="error">{displayError}</MessagePanel>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-zinc-950">
              <video
                ref={(node) => {
                  videoRef.current = node
                  setVideoElement(node)
                }}
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
