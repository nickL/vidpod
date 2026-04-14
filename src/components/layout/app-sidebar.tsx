"use client"

import { useState } from "react"
import Image from "next/image"
import { motion } from "motion/react"
import {
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  Download,
  HelpCircle,
  House,
  Lightbulb,
  MailPlus,
  PlayCircle,
  Settings,
  Tv,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type NavItem = {
  label: string
  icon: LucideIcon
  isActive?: boolean
}

const primaryNav: NavItem[] = [
  { label: "Dashboard", icon: House },
  { label: "Analytics", icon: BarChart3 },
  { label: "Ads", icon: CircleDollarSign, isActive: true },
  { label: "Channels", icon: Tv },
  { label: "Import", icon: Download },
  { label: "Settings", icon: Settings },
]

export const AppSidebar = () => {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-4 px-8 pt-8">
        <CreateEpisodeButton />
        <TeamSelector />
      </div>
      <PrimaryNav />
      <StatsCard />
      <BottomNav />
    </div>
  )
}

type BottomNavItem = {
  label: string
  icon: LucideIcon
  hasToggle?: boolean
}

const bottomNav: BottomNavItem[] = [
  { label: "Demo mode", icon: PlayCircle, hasToggle: true },
  { label: "Invite your team", icon: MailPlus },
  { label: "Give feedback", icon: Lightbulb },
  { label: "Help & support", icon: HelpCircle },
]

const BottomNav = () => (
  <nav className="mt-auto flex flex-col gap-4 px-8 pb-8">
    {bottomNav.map((item) => (
      <BottomNavButton key={item.label} {...item} />
    ))}
  </nav>
)

const StatsCard = () => (
  <div className="my-44 px-8">
    <Image
      src="/sidebar/stats-card.svg"
      alt="Weekly plays — placeholder"
      width={256}
      height={226}
      className="h-auto w-full"
    />
  </div>
)

const BottomNavButton = ({ label, icon: Icon, hasToggle }: BottomNavItem) => (
  <button
    type="button"
    style={{ fontFamily: "var(--font-manrope)" }}
    className="flex h-6 cursor-pointer items-center gap-3 rounded-md text-base font-bold text-zinc-500 transition-colors hover:text-zinc-800"
  >
    <Icon className="size-5" strokeWidth={1.5} />
    <span className="flex-1 text-left">{label}</span>
    {hasToggle ? <ToggleSwitch /> : null}
  </button>
)

const ToggleSwitch = () => (
  <div
    role="switch"
    aria-checked="false"
    className="flex h-5 w-9 shrink-0 items-center rounded-full bg-zinc-200 p-0.5"
  >
    <div className="size-4 rounded-full bg-white shadow-sm" />
  </div>
)

const CreateEpisodeButton = () => (
  <Button size="lg" className="w-full rounded-md">
    Create an episode
  </Button>
)

const TeamSelector = () => (
  <button
    type="button"
    className="flex h-14 w-full cursor-pointer items-center gap-4 rounded-lg border border-zinc-200 bg-white px-4 text-left transition-colors hover:bg-zinc-50"
  >
    <div className="flex flex-1 items-center gap-3 min-w-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded bg-zinc-900">
        <span className="text-[9px] font-bold tracking-tight text-zinc-50">
          DOAC
        </span>
      </div>
      <span
        style={{ fontFamily: "var(--font-manrope)" }}
        className="truncate text-base font-bold text-zinc-500"
      >
        The Diary Of A CEO
      </span>
    </div>
    <ChevronDown className="size-4 shrink-0 text-zinc-500" />
  </button>
)

const PrimaryNav = () => {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null)
  const activeLabel = primaryNav.find((item) => item.isActive)?.label ?? null
  const focusedLabel = hoveredLabel ?? activeLabel
  return (
    <nav
      className="flex flex-col gap-8 px-8 pt-8"
      onMouseLeave={() => setHoveredLabel(null)}
    >
      {primaryNav.map((item) => (
        <NavButton
          key={item.label}
          {...item}
          isFocused={focusedLabel === item.label}
          isHovered={hoveredLabel === item.label}
          onHover={() => setHoveredLabel(item.label)}
        />
      ))}
    </nav>
  )
}

const NavButton = ({
  label,
  icon: Icon,
  isActive,
  isFocused,
  isHovered,
  onHover,
}: NavItem & {
  isFocused: boolean
  isHovered: boolean
  onHover: () => void
}) => {
  const iconStrokeWidth = isActive ? 2 : isHovered ? 1.85 : 1.5
  const textColor = isActive || isHovered ? "text-zinc-800" : "text-zinc-500"

  return (
    <button
      type="button"
      onMouseEnter={onHover}
      style={{ fontFamily: "var(--font-manrope)" }}
      className={cn(
        "relative flex h-8 items-center gap-4 rounded-md px-8 text-2xl font-bold transition-colors duration-150",
        textColor
      )}
    >
      {isFocused ? (
        <motion.span
          layoutId="nav-focus-pill"
          className="absolute inset-x-0 -inset-y-2 -z-10 rounded-md bg-zinc-100"
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 32,
          }}
        />
      ) : null}
      <Icon className="size-5" strokeWidth={iconStrokeWidth} />
      <span>{label}</span>
    </button>
  )
}
