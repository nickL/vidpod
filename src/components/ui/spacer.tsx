import { cn } from "@/lib/utils"

function Spacer({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="spacer" className={cn(className ?? "flex-1")} {...props} />
}

export { Spacer }
