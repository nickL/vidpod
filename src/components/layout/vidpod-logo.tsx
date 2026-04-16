import { cn } from "@/lib/utils"

/* From Figma */

export const VidpodLogo = ({ className }: { className?: string }) => (
  <svg
    width={22}
    height={24}
    viewBox="64 40 22 24"
    fill="none"
    className={cn("text-zinc-500", className)}
  >
    <path
      d="M75.5205 40L86.1575 55.9555C86.6366 56.6743 86.4113 57.6481 85.6651 58.0833L75.5205 64M75.5205 40L64.8834 55.9555C64.4043 56.6743 64.6307 57.6488 65.3769 58.084C69.0595 60.2318 71.5013 61.6559 75.5205 64M75.5205 40V64"
      stroke="currentColor"
    />
  </svg>
)
