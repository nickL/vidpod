"use client"

import { useEffect, useState } from "react"
import { Info, X } from "lucide-react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"

import { projectIntro } from "./project-intro-content"

const STORAGE_KEY = "vidpod:intro-seen"
const manropeStyle = { fontFamily: "var(--font-manrope)" }

export const ProjectIntroPanel = () => {
  const [hasSeen, setHasSeen] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const seen = window.localStorage.getItem(STORAGE_KEY) === "true"

    // Read localStorage after mount so SSR and client hydration keep in sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasSeen(seen)
    if (!seen) {
      setIsOpen(true)
    }
  }, [])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open && !hasSeen) {
      window.localStorage.setItem(STORAGE_KEY, "true")
      setHasSeen(true)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="About this build"
        className="absolute -right-1.5 -top-1.5 inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-200 transition-shadow hover:shadow-md"
        onClick={() => setIsOpen(true)}
      >
        <Info className="size-3.5" />
        {!hasSeen ? (
          <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-red-500 ring-2 ring-white" />
        ) : null}
      </button>

      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="gap-0 border-zinc-800 bg-zinc-950 p-0 text-zinc-100 sm:max-w-md"
        >
          <SheetClose
            className="absolute right-4 top-4 inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="size-4" />
          </SheetClose>

          <div className="flex h-full flex-col overflow-y-auto px-8 py-10">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              Project Notes
            </p>
            <SheetTitle
              style={manropeStyle}
              className="mt-3 text-3xl font-bold text-zinc-50"
            >
              {projectIntro.title}
            </SheetTitle>
            <SheetDescription className="mt-1 text-sm text-zinc-400">
              {projectIntro.subtitle}
            </SheetDescription>

            <p className="mt-5 text-[13px] italic leading-relaxed text-zinc-500 lg:hidden">
              {projectIntro.mobileNotice}
            </p>

            <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-zinc-300 [&_strong]:font-semibold [&_strong]:text-zinc-50 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:marker:text-zinc-600">
              {projectIntro.intro}
            </div>

            <div className="mt-8 h-px bg-zinc-800" />

            <p className="mt-8 text-xs uppercase tracking-[0.18em] text-zinc-500">
              Technical Notes
            </p>
            <ul className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-zinc-300">
              {projectIntro.technicalNotes.map((note, index) => (
                <li key={index} className="flex gap-3">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-zinc-600" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>

            <p
              style={manropeStyle}
              className="mt-auto pt-10 text-sm text-zinc-400"
            >
              {projectIntro.signoff}
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
