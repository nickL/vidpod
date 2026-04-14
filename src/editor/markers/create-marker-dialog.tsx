"use client"

import { CircleDot, Dices, EqualApproximately, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import type { Marker } from "../types"

type CreateMarkerDialogProps = {
  open: boolean
  selectionMode: Marker["selectionMode"]
  onSelectionModeChange: (selectionMode: Marker["selectionMode"]) => void
  onContinue: () => void
  onOpenChange: (open: boolean) => void
}

const modeOptions: Array<{
  selectionMode: Marker["selectionMode"]
  title: string
  description: string
  icon: LucideIcon
}> = [
  {
    selectionMode: "auto",
    title: "Auto",
    description: "Automatic ad insertions",
    icon: Dices,
  },
  {
    selectionMode: "static",
    title: "Static",
    description: "A marker for a specific ad that you select",
    icon: CircleDot,
  },
  {
    selectionMode: "ab",
    title: "A/B test",
    description: "Compare the performance of multiple ads",
    icon: EqualApproximately,
  },
]

export const CreateMarkerDialog = ({
  open,
  selectionMode,
  onSelectionModeChange,
  onContinue,
  onOpenChange,
}: CreateMarkerDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[412px] gap-0 overflow-hidden p-0"
        showCloseButton
      >
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle>Create ad marker</DialogTitle>
          <DialogDescription>
            Insert a new ad marker into this episode
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5">
          <div className="flex flex-col gap-2.5">
            {modeOptions.map((option) => (
              <ModeOptionCard
                key={option.selectionMode}
                title={option.title}
                description={option.description}
                icon={option.icon}
                selected={selectionMode === option.selectionMode}
                onSelect={() => onSelectionModeChange(option.selectionMode)}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onContinue}>Select marker</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type ModeOptionCardProps = {
  title: string
  description: string
  icon: LucideIcon
  selected: boolean
  onSelect: () => void
}

const ModeOptionCard = ({
  title,
  description,
  icon: Icon,
  selected,
  onSelect,
}: ModeOptionCardProps) => {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        selected
          ? "border-zinc-900 bg-zinc-50"
          : "border-zinc-200 bg-white hover:border-zinc-300",
      )}
      onClick={onSelect}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700">
        <Icon className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-zinc-900">{title}</span>
        <span className="text-xs text-zinc-500">{description}</span>
      </div>
      <div
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-zinc-900" : "border-zinc-300",
        )}
      >
        {selected ? <div className="size-2 rounded-full bg-zinc-900" /> : null}
      </div>
    </button>
  )
}
