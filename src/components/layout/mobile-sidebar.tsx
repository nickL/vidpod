import {
  BarChart3,
  CircleDollarSign,
  Download,
  House,
  Settings,
  Tv,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

import { VidpodLogo } from "./vidpod-logo"

type MobileNavItem = {
  label: string
  icon: LucideIcon
  isActive?: boolean
}

const mobileNav: MobileNavItem[] = [
  { label: "Dashboard", icon: House },
  { label: "Analytics", icon: BarChart3 },
  { label: "Ads", icon: CircleDollarSign, isActive: true },
  { label: "Channels", icon: Tv },
  { label: "Import", icon: Download },
  { label: "Settings", icon: Settings },
]

export const MobileSidebar = () => (
  <aside className="sticky top-[104px] flex w-16 shrink-0 flex-col items-center gap-7 self-stretch border-r border-zinc-200 bg-sidebar pt-7 lg:hidden">
    <VidpodLogo className="text-zinc-700" />
    <nav className="flex flex-col items-center gap-6">
      {mobileNav.map((item) => (
        <button
          key={item.label}
          type="button"
          aria-label={item.label}
          className={cn(
            "flex size-9 items-center justify-center rounded-md transition-colors",
            item.isActive
              ? "bg-zinc-900 text-zinc-50"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800",
          )}
        >
          <item.icon
            className="size-5"
            strokeWidth={item.isActive ? 2 : 1.5}
          />
        </button>
      ))}
    </nav>
  </aside>
)
