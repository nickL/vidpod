import { Bell, Settings } from "lucide-react"
import { RiArrowDownSLine } from "react-icons/ri"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Spacer } from "@/components/ui/spacer"
import { ProjectIntroPanel } from "@/components/project-intro/project-intro-panel"
import { cn } from "@/lib/utils"

import { ActivityBar } from "./activity-bar"
import { AppBar } from "./app-bar"
import { VidpodLogo } from "./vidpod-logo"

export const AppHeader = ({ isScrolled }: { isScrolled: boolean }) => {
  return (
    <header className="relative">
      <ActivityBar />
      <AppBar
        border="bottom"
        className="h-[var(--app-header-h)] transition-[height] duration-200"
      >
        <BrandMark />
        <Spacer />
        <HeaderActions isScrolled={isScrolled} />
      </AppBar>
    </header>
  )
}

const BrandMark = () => (
  <div className="flex items-center gap-4">
    <VidpodLogo />
    <span
      style={{ fontFamily: "var(--font-manrope)" }}
      className="text-2xl font-bold text-zinc-800"
    >
      Vidpod
    </span>
  </div>
)

const HeaderActions = ({ isScrolled }: { isScrolled: boolean }) => (
  <div className="flex items-center gap-4 lg:gap-8">
    <button
      type="button"
      aria-label="Settings"
      className="hidden cursor-pointer text-zinc-500 transition-opacity hover:opacity-70 lg:inline-flex"
    >
      <Settings className="size-5" />
    </button>
    <NotificationButton />
    <div className="relative">
      <UserButton isScrolled={isScrolled} />
      <ProjectIntroPanel />
    </div>
  </div>
)

const NotificationButton = () => (
  <button
    type="button"
    aria-label="Notifications"
    className="relative hidden cursor-pointer text-zinc-500 transition-opacity hover:opacity-70 lg:inline-flex"
  >
    <Bell className="size-5" />
    <span className="absolute right-0.5 top-1 size-1.5 rounded-full bg-red-500 ring-2 ring-white" />
  </button>
)

const UserButton = ({ isScrolled }: { isScrolled: boolean }) => (
  <button
    type="button"
    className={cn(
      "flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 shadow-sm transition-[height] duration-200 hover:shadow-md lg:px-4",
      isScrolled ? "h-10" : "h-14"
    )}
  >
    <Avatar className="size-8">
      <AvatarFallback className="bg-zinc-200 text-xs font-medium text-zinc-700">
        NL
      </AvatarFallback>
    </Avatar>
    <span
      style={{ fontFamily: "var(--font-manrope)" }}
      className="hidden text-base font-bold text-zinc-800 lg:inline"
    >
      Nick Lewis
    </span>
    <RiArrowDownSLine className="hidden size-4 text-zinc-950 lg:inline" />
  </button>
)
