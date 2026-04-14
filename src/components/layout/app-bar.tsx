import { cn } from "@/lib/utils"

type AppBarProps = {
  border: "top" | "bottom"
  children?: React.ReactNode
  className?: string
}

export const AppBar = ({ border, children, className }: AppBarProps) => {
  return (
    <div
      className={cn(
        "flex h-26 shrink-0 items-center px-8",
        border === "top" ? "border-t" : "border-b",
        className
      )}
    >
      {children}
    </div>
  )
}
