import { AppSidebar } from "./app-sidebar"
import { AppHeader } from "./app-header"
import { AppFooter } from "./app-footer"
import { APP_HEADER_HEIGHT_PX } from "./constants"
import { DesktopOnlyNotice } from "./desktop-only-notice"
import { MobileSidebar } from "./mobile-sidebar"

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl backdrop-saturate-150">
        <AppHeader />
      </div>
      <div className="flex flex-1">
        <aside
          className="sticky hidden w-80 shrink-0 self-start border-r border-zinc-200 bg-sidebar lg:block"
          style={{ top: APP_HEADER_HEIGHT_PX }}
        >
          <AppSidebar />
        </aside>
        <MobileSidebar />
        <main className="flex min-w-0 flex-1 flex-col p-8 lg:p-12 xl:p-16">
          <div className="lg:hidden">
            <DesktopOnlyNotice />
          </div>
          <div className="hidden lg:block">{children}</div>
        </main>
      </div>
      <AppFooter />
    </div>
  )
}
