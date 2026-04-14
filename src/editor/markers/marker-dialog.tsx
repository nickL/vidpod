"use client"

import { AdLibraryDialog } from "../ads/ad-library-dialog"
import { CreateMarkerDialog } from "./create-marker-dialog"

import type { AdLibraryItem, Marker, UploadProgressState } from "../types"
import type { MarkerDialogDraft, MarkerDialogState } from "./dialog-state"

type MarkerDialogProps = {
  adLibrary: AdLibraryItem[]
  isSaving: boolean
  markerDialogState?: MarkerDialogState
  uploadError?: string
  uploadProgressByMediaAssetId: Record<string, UploadProgressState>
  onClose: () => void
  onConfirm: () => void
  onContinue: () => void
  onDraftChange: (draft: MarkerDialogDraft) => void
  onSelectionModeChange: (selectionMode: Marker["selectionMode"]) => void
  onUploadAds: (files: File[]) => void | Promise<void>
}

export const MarkerDialog = ({
  adLibrary,
  isSaving,
  markerDialogState,
  uploadError,
  uploadProgressByMediaAssetId,
  onClose,
  onConfirm,
  onContinue,
  onDraftChange,
  onSelectionModeChange,
  onUploadAds,
}: MarkerDialogProps) => {
  if (!markerDialogState) {
    return null
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  if (markerDialogState.step === "select-mode") {
    return (
      <CreateMarkerDialog
        open
        selectionMode={markerDialogState.draft.selectionMode}
        onSelectionModeChange={onSelectionModeChange}
        onContinue={onContinue}
        onOpenChange={handleOpenChange}
      />
    )
  }

  return (
    <AdLibraryDialog
      open
      mode={markerDialogState.mode}
      adLibrary={adLibrary}
      draft={markerDialogState.draft}
      isSaving={isSaving}
      uploadError={uploadError}
      uploadProgressByMediaAssetId={uploadProgressByMediaAssetId}
      onDraftChange={onDraftChange}
      onConfirm={onConfirm}
      onUploadAds={onUploadAds}
      onOpenChange={handleOpenChange}
    />
  )
}
