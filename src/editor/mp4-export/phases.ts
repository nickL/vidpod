export const MP4_EXPORT_JOB_PHASES = [
  "preparing",
  "rendering",
  "uploading",
] as const

export type Mp4ExportJobPhase = (typeof MP4_EXPORT_JOB_PHASES)[number]

export const isMp4ExportJobPhase = (
  value: unknown
): value is Mp4ExportJobPhase => {
  return MP4_EXPORT_JOB_PHASES.includes(value as Mp4ExportJobPhase)
}

export const getMp4ExportJobPhaseMessage = (phase: Mp4ExportJobPhase) => {
  switch (phase) {
    case "preparing":
      return "Getting the export ready…"
    case "rendering":
      return "Rendering the MP4…"
    case "uploading":
      return "Uploading the finished MP4…"
  }
}
