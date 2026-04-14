import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { AppHeader } from "./app-header"
import { AppFooter } from "./app-footer"

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex-1 overflow-y-auto p-16">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      <AppFooter />
    </div>
  )
}
