"use client"

import { useMemo, useRef, useState, type ChangeEvent } from "react"
import Image from "next/image"
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  FolderOpen,
  Library,
  Plus,
  Search,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { capitalize, cn, formatDate, formatDuration } from "@/lib/utils"

import type { MarkerDialogDraft } from "../markers/dialog-state"
import type { AdLibraryItem, Marker, UploadProgressState } from "../types"

const SELECTION_MODE_LABEL = { ab: "A/B test", auto: "Auto", static: "Static" } as const

const SELECTION_MODE_DESCRIPTION = {
  static: "Select the exact ad this marker should play",
  auto: "Select the ads this marker can choose from during playback",
  ab: "Select which ads you'd like to A/B test",
} as const

const getAdTags = (adTitle: string) => {
  if (adTitle.includes("(90s)")) {
    return ["Example ads", "90s"]
  }

  if (adTitle.includes("(Classic)")) {
    return ["Example ads", "Classic"]
  }

  return []
}

type AdLibraryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  adLibrary: AdLibraryItem[]
  draft: MarkerDialogDraft
  isSaving?: boolean
  uploadError?: string
  uploadProgressByMediaAssetId: Record<string, UploadProgressState>
  onDraftChange: (draft: MarkerDialogDraft) => void
  onConfirm: () => void
  onUploadAds: (files: File[]) => void | Promise<void>
}

export const AdLibraryDialog = ({
  open,
  onOpenChange,
  mode,
  adLibrary,
  draft,
  isSaving = false,
  uploadError,
  uploadProgressByMediaAssetId,
  onDraftChange,
  onConfirm,
  onUploadAds,
}: AdLibraryDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortNewestFirst, setSortNewestFirst] = useState(true)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)

  const visibleAds = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase()
    const matchingAds = normalizedSearchQuery
      ? adLibrary.filter((ad) =>
          ad.title.toLowerCase().includes(normalizedSearchQuery)
        )
      : adLibrary

    return [...matchingAds].sort((leftAd, rightAd) => {
      const leftCreatedAt = new Date(leftAd.createdAt).getTime()
      const rightCreatedAt = new Date(rightAd.createdAt).getTime()

      return sortNewestFirst
        ? rightCreatedAt - leftCreatedAt
        : leftCreatedAt - rightCreatedAt
    })
  }, [adLibrary, searchQuery, sortNewestFirst])

  const isAb = draft.selectionMode === "ab"
  const isEdit = mode === "edit"

  const title = isAb ? "A/B test" : isEdit ? "Edit ad marker" : "Create ad marker"
  const confirmLabel = isEdit ? "Save changes" : isAb ? "Create A/B test" : "Create marker"
  const description = SELECTION_MODE_DESCRIPTION[draft.selectionMode]

  const canConfirm = isSelectionValid(
    draft.selectionMode,
    draft.selectedAdAssetIds
  )
  const handleUploadAdsClick = () => {
    uploadInputRef.current?.click()
  }
  const handleAdFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])

    event.currentTarget.value = ""

    if (files.length === 0) {
      return
    }

    setSearchQuery("")
    onUploadAds(files)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(720px,calc(100vh-5rem))] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader className="px-6 pt-10 pb-5 md:px-8">
          <input
            ref={uploadInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={handleAdFileChange}
          />
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1 pr-8">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {description}
              </DialogDescription>
            </div>
            <Button
              className="ml-auto shrink-0 cursor-pointer"
              onClick={handleUploadAdsClick}
            >
              Upload Ad
              <Plus />
            </Button>
          </div>
        </DialogHeader>

        <div className="mx-6 border-t border-zinc-200 md:mx-8" />

        <div className="flex min-h-0 flex-1 gap-0 overflow-hidden p-5 md:min-h-105">
          <div className="hidden md:flex w-52 shrink-0 flex-col gap-5 rounded-lg bg-zinc-100 p-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search library..."
                className="bg-white pl-9"
                autoComplete="off"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
              />
            </div>
            <nav className="flex flex-col gap-5">
              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Library className="size-4" />
                Ad library
              </span>
              <span className="text-sm text-zinc-500">
                All folders
              </span>

              <div className="flex flex-col">
                <div className="flex items-center justify-between text-sm font-medium text-zinc-900">
                  Example ads
                  <ChevronDown className="size-4 text-zinc-400" />
                </div>
                <div className="ml-1 mt-3 flex flex-col gap-4 border-l border-zinc-300 pl-4">
                  <span className="text-sm text-zinc-500">90s</span>
                  <span className="text-sm text-zinc-500">Classic</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-zinc-700">
                Brilliant
                <ChevronUp className="size-4 text-zinc-400" />
              </div>

              <div className="flex items-center justify-between text-sm text-zinc-700">
                Milligram
                <ChevronUp className="size-4 text-zinc-400" />
              </div>
            </nav>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 px-0 py-1 md:px-5">
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <Button variant="outline" size="lg" className="md:hidden">
                <FolderOpen className="size-4" />
                {SELECTION_MODE_LABEL[draft.selectionMode]}
                <ChevronDown className="size-3.5 text-zinc-400" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-muted-foreground"
                onClick={() => setSortNewestFirst((currentValue) => !currentValue)}
              >
                <ChevronsUpDown className="size-4" />
                Upload date
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Search ads..."
                  className="w-32 pl-9 sm:w-44"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.currentTarget.value)}
                />
              </div>
            </div>
            {uploadError ? (
              <p className="text-sm text-red-600">{uploadError}</p>
            ) : null}

            <ScrollArea
              className="min-h-0 flex-1 mask-[linear-gradient(to_bottom,black_calc(100%-3rem),transparent)] [-webkit-mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]"
            >
              <div className="flex flex-col gap-4 pb-8">
                {visibleAds.map((ad) => (
                  <AdCard
                    key={ad.id}
                    ad={ad}
                    selected={draft.selectedAdAssetIds.includes(ad.id)}
                    uploadProgress={
                      uploadProgressByMediaAssetId[ad.mediaAsset.id]
                    }
                    onToggle={() =>
                      onDraftChange({
                        ...draft,
                        selectedAdAssetIds: toggleSelection({
                          selectionMode: draft.selectionMode,
                          selectedAdAssetIds: draft.selectedAdAssetIds,
                          adAssetId: ad.id,
                        }),
                      })
                    }
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="mx-6 border-t border-zinc-200 md:mx-8" />
        <div className="flex items-center justify-between gap-3 px-6 py-5 md:px-8">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <div className="flex items-center gap-3 md:gap-4">
            <span className="shrink-0 text-sm text-zinc-500">
              {draft.selectedAdAssetIds.length} ads selected
            </span>
            <Button
              className="shrink-0"
              onClick={onConfirm}
              disabled={!canConfirm || isSaving}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const AdCard = ({
  ad,
  selected,
  uploadProgress,
  onToggle,
}: {
  ad: AdLibraryItem
  selected: boolean
  uploadProgress?: UploadProgressState
  onToggle: () => void
}) => {
  const duration = ad.mediaAsset.durationMs
    ? formatDuration(ad.mediaAsset.durationMs)
    : null
  const createdAt = formatDate(ad.createdAt, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  })

  const tags = getAdTags(ad.title)
  const isSelectable = ad.mediaAsset.status === "ready"
  const statusLabel = uploadProgress
    ? capitalize(uploadProgress.phase)
    : ad.mediaAsset.status === "ready"
      ? undefined
      : capitalize(ad.mediaAsset.status)

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 sm:gap-4",
        selected ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white",
        isSelectable ? "cursor-pointer" : "opacity-70",
      )}
      onClick={isSelectable ? onToggle : undefined}
    >
      <div className="hidden h-18 w-24 shrink-0 overflow-hidden rounded border border-zinc-300 bg-zinc-100 sm:block">
        {ad.mediaAsset.thumbnailUrl ? (
          <div className="relative h-full w-full">
            <Image
              src={ad.mediaAsset.thumbnailUrl}
              alt={ad.title}
              fill
              unoptimized
              sizes="96px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
            No preview
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-900">{ad.title}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
          <span>{createdAt}</span>
          <span>•</span>
          <span>{duration}</span>
          <span className="text-zinc-300">—</span>
          <Avatar size="sm" className="size-2.5 border-0">
            <AvatarFallback className="border-0 bg-[#FEC16B] text-[5px] font-medium text-[#7A3814]">
              N
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-zinc-700">Nick Lewis</span>
        </span>
        {statusLabel ? (
          <span className="text-xs font-medium text-zinc-500">
            {statusLabel}
          </span>
        ) : null}
        {tags.length > 0 && (
          <div className="flex items-center gap-2">
            {tags.map((tag, i) => (
              <span key={tag} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="size-3 text-zinc-400" />}
                <span className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-600">
                  {tag}
                </span>
              </span>
            ))}
          </div>
        )}
        {uploadProgress ? (
          <Progress value={uploadProgress.progressPercent} />
        ) : null}
      </div>

      <Checkbox
        checked={selected}
        disabled={!isSelectable}
        className="size-4 border-zinc-900"
      />
    </div>
  )
}

const isSelectionValid = (
  selectionMode: Marker["selectionMode"],
  selectedAdAssetIds: string[]
) => {
  if (selectionMode === "static") {
    return selectedAdAssetIds.length === 1
  }

  if (selectionMode === "ab") {
    return selectedAdAssetIds.length >= 2
  }

  return selectedAdAssetIds.length >= 1
}

const toggleSelection = ({
  selectionMode,
  selectedAdAssetIds,
  adAssetId,
}: {
  selectionMode: Marker["selectionMode"]
  selectedAdAssetIds: string[]
  adAssetId: string
}) => {
  if (selectionMode === "static") {
    return selectedAdAssetIds[0] === adAssetId ? [] : [adAssetId]
  }

  return selectedAdAssetIds.includes(adAssetId)
    ? selectedAdAssetIds.filter((currentAdAssetId) => currentAdAssetId !== adAssetId)
    : [...selectedAdAssetIds, adAssetId]
}
