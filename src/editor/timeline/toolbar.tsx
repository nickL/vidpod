import { Redo2, Undo2, ZoomIn, ZoomOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spacer } from "@/components/ui/spacer"
import { formatTimecode } from "@/lib/utils"

type ToolbarProps = {
  currentTimeMs: number
  zoomPercent: number
  canZoomIn: boolean
  canZoomOut: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void | Promise<void>
  onRedo: () => void | Promise<void>
  onZoomChange: (zoomPercent: number) => void
  onZoomIn: () => void
  onZoomOut: () => void
}

type ZoomSliderProps = Pick<
  ToolbarProps,
  "zoomPercent" | "canZoomIn" | "canZoomOut" | "onZoomChange" | "onZoomIn" | "onZoomOut"
>

const ZOOM_SLIDER_STEP = 0.1

export const Toolbar = ({
  currentTimeMs,
  zoomPercent,
  canZoomIn,
  canZoomOut,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onZoomChange,
  onZoomIn,
  onZoomOut,
}: ToolbarProps) => {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <HistoryButtons
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
      />
      <Spacer />
      <TimeDisplay timeMs={currentTimeMs} />
      <Spacer />
      <ZoomSlider
        zoomPercent={zoomPercent}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
        onZoomChange={onZoomChange}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />
    </div>
  )
}

const HistoryButtons = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void | Promise<void>
  onRedo: () => void | Promise<void>
}) => {
  return (
    <div className="flex items-center gap-6 lg:gap-12">
      <HistoryButton icon={Undo2} label="Undo" disabled={!canUndo} onClick={onUndo} />
      <HistoryButton icon={Redo2} label="Redo" disabled={!canRedo} onClick={onRedo} />
    </div>
  )
}

const HistoryButton = ({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: typeof Undo2
  label: string
  disabled: boolean
  onClick: () => void | Promise<void>
}) => {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto gap-3.5 p-0 hover:bg-transparent"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex size-7.75 items-center justify-center rounded-full border border-zinc-300 transition-colors group-hover/button:border-zinc-400 group-hover/button:bg-zinc-50">
        <Icon className="size-3.5 text-black" />
      </span>
      <span className="text-sm text-zinc-500 transition-colors group-hover/button:text-zinc-700">
        {label}
      </span>
    </Button>
  )
}

const TimeDisplay = ({ timeMs }: { timeMs: number }) => {
  return (
    <div className="flex h-10 items-center rounded-md border border-zinc-200 px-3">
      <span className="text-sm tabular-nums text-zinc-500">
        {formatTimecode(timeMs)}
      </span>
    </div>
  )
}

const ZoomSlider = ({
  zoomPercent,
  canZoomIn,
  canZoomOut,
  onZoomChange,
  onZoomIn,
  onZoomOut,
}: ZoomSliderProps) => {
  const handleRangeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onZoomChange(Number(event.currentTarget.value))
  }

  return (
    <div className="flex items-center gap-6">
      <button
        type="button"
        className="appearance-none bg-transparent p-0 disabled:opacity-40"
        onClick={onZoomOut}
        disabled={!canZoomOut}
      >
        <ZoomOut className="size-4 text-zinc-800" />
      </button>

      <div className="relative w-50">
        <input
          type="range"
          min={0}
          max={100}
          step={ZOOM_SLIDER_STEP}
          value={zoomPercent}
          aria-label="Timeline zoom"
          className="absolute inset-x-0 top-1/2 z-10 h-6 -translate-y-1/2 cursor-pointer appearance-none bg-transparent opacity-0"
          onChange={handleRangeChange}
        />
        <div className="pointer-events-none relative h-1 rounded-full bg-zinc-100">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-zinc-300"
            style={{ width: `${zoomPercent}%` }}
          />
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-800"
            style={{ left: `${zoomPercent}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        className="appearance-none bg-transparent p-0 disabled:opacity-40"
        onClick={onZoomIn}
        disabled={!canZoomIn}
      >
        <ZoomIn className="size-4 text-zinc-800" />
      </button>
    </div>
  )
}
