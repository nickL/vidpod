"use client"

import { Captions } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type TranscriptButtonProps = {
  isOpen: boolean
  onToggle: () => void
}

export const TranscriptButton = ({
  isOpen,
  onToggle,
}: TranscriptButtonProps) => {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto gap-3.5 p-0 hover:bg-transparent"
      onClick={onToggle}
      aria-pressed={isOpen}
    >
      <span
        className={cn(
          "flex size-7.75 items-center justify-center rounded-full border transition-colors",
          isOpen
            ? "border-zinc-900 bg-zinc-900"
            : "border-zinc-300 group-hover/button:border-zinc-400 group-hover/button:bg-zinc-50"
        )}
      >
        <Captions
          className={cn("size-3.5", isOpen ? "text-white" : "text-black")}
        />
      </span>
      <span className="text-sm text-zinc-500 transition-colors group-hover/button:text-zinc-700">
        Transcript
      </span>
    </Button>
  )
}
