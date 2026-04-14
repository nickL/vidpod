import { VidpodLogo } from "./vidpod-logo"

const manropeStyle = { fontFamily: "var(--font-manrope)" }

export const DesktopOnlyNotice = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
    <div className="flex items-center gap-3">
      <VidpodLogo className="size-8 text-zinc-700" />
      <span
        style={manropeStyle}
        className="text-2xl font-bold text-zinc-800"
      >
        Vidpod
      </span>
    </div>

    <h1
      style={manropeStyle}
      className="mt-10 text-2xl font-bold text-zinc-900"
    >
      Editor works best on desktop.
    </h1>

    <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-zinc-500">
      The editor needs precision to help you build awesome videos.
      Open it on a laptop or a larger screen to get started.
    </p>
  </div>
)
