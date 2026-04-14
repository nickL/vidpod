"use client"

import Image from "next/image"
import { ArrowRight, ChevronDown, ChevronUp, ChevronsUpDown, FolderOpen, Library, Search } from "lucide-react"

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
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDuration } from "@/lib/utils"

import type { AdLibraryItem } from "./types"

const adTagMap: Record<string, string[]> = {
  "Eight Sleep Q4 Pod 3 - v1": ["Eight Sleep", "Pod 3"],
  "Eight Sleep Q4 Pod 3 - v2": ["Eight Sleep", "Pod 3"],
  "Brilliant (maths & physics)": ["Brilliant", "Back to school '24"],
}

type AdLibraryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  adLibrary: AdLibraryItem[]
}

export const AdLibraryDialog = ({
  open,
  onOpenChange,
  adLibrary,
}: AdLibraryDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl p-0 gap-0 overflow-hidden" showCloseButton>
        <DialogHeader className="px-6 pt-6 pb-5 md:px-8">
          <DialogTitle>A/B test</DialogTitle>
          <DialogDescription>
            Select which ads you&apos;d like to A/B test
          </DialogDescription>
        </DialogHeader>

        <div className="mx-6 border-t border-zinc-200 md:mx-8" />

        <div className="flex min-h-0 flex-1 gap-0 overflow-hidden p-5 md:min-h-[420px]">
          {/* Left panel — visible on md+ */}
          <div className="hidden md:flex w-52 shrink-0 flex-col gap-5 rounded-lg bg-zinc-100 p-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search library..."
                className="bg-white pl-9"
                autoComplete="off"
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
                <button
                  type="button"
                  className="flex items-center justify-between text-sm font-medium text-zinc-900"
                >
                  Eight Sleep
                  <ChevronDown className="size-4 text-zinc-400" />
                </button>
                <div className="ml-1 mt-3 flex flex-col gap-4 border-l border-zinc-300 pl-4">
                  <span className="text-sm text-zinc-500">Pod 3</span>
                  <span className="text-sm text-zinc-500">Q3 Promo</span>
                  <span className="text-sm text-zinc-500">Athlete Campaign</span>
                </div>
              </div>

              <button
                type="button"
                className="flex items-center justify-between text-sm text-zinc-700"
              >
                Brilliant
                <ChevronUp className="size-4 text-zinc-400" />
              </button>

              <button
                type="button"
                className="flex items-center justify-between text-sm text-zinc-700"
              >
                Milligram
                <ChevronUp className="size-4 text-zinc-400" />
              </button>
            </nav>
          </div>

          {/* Right panel — ad list */}
          <div className="flex flex-1 flex-col gap-3 px-0 py-1 md:px-5">
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {/* Mobile folder selector — visible below md */}
              <Button variant="outline" size="lg" className="md:hidden">
                <FolderOpen className="size-4" />
                All folders
                <ChevronDown className="size-3.5 text-zinc-400" />
              </Button>
              <div className="flex-1" />
              <Button variant="outline" size="lg" className="text-muted-foreground">
                <ChevronsUpDown className="size-4" />
                Upload date
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Search ads..."
                  className="w-32 pl-9 sm:w-44"
                  autoComplete="off"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-4">
                {adLibrary.map((ad) => (
                  <AdCard key={ad.id} ad={ad} />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="mx-6 border-t border-zinc-200 md:mx-8" />
        <div className="flex items-center justify-between gap-3 px-6 py-5 md:px-8">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex items-center gap-3 md:gap-4">
            <span className="shrink-0 text-sm text-zinc-500">0 ads selected</span>
            <Button className="shrink-0">Create A/B test</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const AdCard = ({ ad }: { ad: AdLibraryItem }) => {
  const duration = ad.mediaAsset.durationMs
    ? formatDuration(ad.mediaAsset.durationMs)
    : null

  const tags = adTagMap[ad.title] ?? []

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:gap-4">
      <div className="hidden h-[72px] w-[96px] shrink-0 overflow-hidden rounded border border-zinc-300 bg-zinc-100 sm:block">
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
          <span>13/03/24</span>
          <span>•</span>
          <span>{duration}</span>
          <span className="text-zinc-300">—</span>
          <Avatar size="sm" className="size-3.5">
            <AvatarFallback className="bg-orange-200 text-[6px] text-orange-800">
              D
            </AvatarFallback>
          </Avatar>
          <span className="text-zinc-600">Denis Loginoff</span>
        </span>
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
      </div>

      <Checkbox className="size-4 border-zinc-900" />
    </div>
  )
}
