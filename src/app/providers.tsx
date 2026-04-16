"use client"

import { QueryClientProvider } from "@tanstack/react-query"

import { ActivityBarProvider } from "@/components/layout/activity-bar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getQueryClient } from "@/lib/query-client"


export const Providers = ({ children }: { children: React.ReactNode }) => {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <ActivityBarProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ActivityBarProvider>
    </QueryClientProvider>
  )
}
