"use client"

import { AppSidebar } from "./app-sidebar"
import { AppHeader } from "./app-header"
import { AppFooter } from "./app-footer"
import { APP_HEADER_EXPANDED_PX, APP_HEADER_THIN_PX } from "./constants"
import { DesktopOnlyNotice } from "./desktop-only-notice"
import { MobileSidebar } from "./mobile-sidebar"
import { useIsScrolled } from "./use-is-scrolled"

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { pageTopRef, isScrolled } = useIsScrolled()
  const headerHeightPx = isScrolled ? APP_HEADER_THIN_PX : APP_HEADER_EXPANDED_PX

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ "--app-header-h": `${headerHeightPx}px` } as React.CSSProperties}
    >
      <div ref={pageTopRef} aria-hidden />
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl backdrop-saturate-150">
        <AppHeader isScrolled={isScrolled} />
      </div>
      <div className="flex flex-1">
        <aside
          className="sticky hidden w-80 shrink-0 self-start border-r border-zinc-200 bg-sidebar lg:block"
          style={{ top: "var(--app-header-h)" }}
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
