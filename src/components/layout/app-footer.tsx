import { AppBar } from "./app-bar"
import { VidpodLogo } from "./vidpod-logo"

export const AppFooter = () => {
  return (
    <footer>
      <AppBar border="top" className="justify-between">
        <span
          style={{ fontFamily: "var(--font-manrope)" }}
          className="text-base font-semibold text-zinc-500"
        >
          Video first podcasts
        </span>
        <div className="flex items-center gap-4">
          <VidpodLogo />
          <span
            style={{ fontFamily: "var(--font-manrope)" }}
            className="text-2xl font-bold text-zinc-800"
          >
            Vidpod
          </span>
        </div>
      </AppBar>
    </footer>
  )
}
