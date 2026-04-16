"use client"

import { useCallback, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { MotionConfig } from "motion/react"

import { formatDate } from "@/lib/utils"

import { useEditorHistory } from "./use-editor-history"
import { MarkerDialog } from "./markers/marker-dialog"
import { MarkerPanel } from "./markers/marker-panel"
import { useMarkerWorkflow } from "./markers/use-marker-workflow"
import { PlaybackSection } from "./playback/playback-section"
import { getPreviewConfigKey } from "./playback/preview-config"
import { episodeEditorQueryKey } from "./queries"
import { getReplacementEpisodeVideo } from "./uploads/helpers"
import { useUploadManager } from "./uploads/use-upload-manager"
import { useEditorData } from "./use-editor-data"

type EpisodeEditorProps = {
  episodeId: string
  hlsBaseUrl?: string
}

export const EpisodeEditor = ({
  episodeId,
  hlsBaseUrl,
}: EpisodeEditorProps) => {
  const queryClient = useQueryClient()
  const queryKey = episodeEditorQueryKey(episodeId)
  const { data } = useEditorData(episodeId)
  const [timelineTimeMs, setTimelineTimeMs] = useState(0)
  const {
    hasRedo,
    hasUndo,
    isApplyingHistory,
    push: pushHistory,
    redo,
    undo,
  } = useEditorHistory()
  const {
    addEpisodeVideo,
    isResettingDemo,
    removeEpisodeVideo,
    resetDemo,
    uploadAds,
    uploadErrorByTarget,
    uploadProgressByMediaAssetId,
    selectEpisodeVideo,
  } = useUploadManager({
    episodeId,
    adLibrary: data?.adLibrary,
    episodeVideoAssets: data?.episodeVideoAssets,
  })
  const {
    activateMarker,
    applyHistoryEntry,
    autoPlaceMarkers,
    setDialogDraft,
    closeDialog,
    confirmDialog,
    continueDialog,
    createMarkerDisabledReason,
    deleteMarker,
    deletingMarkerId,
    displayedMarkers,
    hasPendingMarkerDragSaves,
    isAutoPlacing,
    isSavingDialog,
    markerActivation,
    markerDialogState,
    openCreateDialog,
    openEditDialog,
    queueMarkerSave,
    savingMarkerIds,
    selectMarker,
    selectedMarkerId,
    setDialogSelectionMode,
  } = useMarkerWorkflow({
    episodeId,
    markers: data?.markers,
    adLibraryIds: data?.adLibrary.map((ad) => ad.id) ?? [],
    durationMs: data?.episode.durationMs,
    timelineTimeMs,
    isApplyingHistory,
    pushHistory,
  })

  const previewConfigKey = useMemo(
    () => getPreviewConfigKey(data?.markers ?? [], data?.mainMediaAsset?.id),
    [data?.mainMediaAsset?.id, data?.markers]
  )

  const isBusy =
    isApplyingHistory ||
    isAutoPlacing ||
    isSavingDialog ||
    deletingMarkerId !== undefined ||
    hasPendingMarkerDragSaves
  const canUndo = !isBusy && hasUndo
  const canRedo = !isBusy && hasRedo

  const handleUndo = useCallback(async () => {
    await undo(applyHistoryEntry, () =>
      queryClient.invalidateQueries({ queryKey })
    )
  }, [applyHistoryEntry, queryClient, queryKey, undo])

  const handleRedo = useCallback(async () => {
    await redo(applyHistoryEntry, () =>
      queryClient.invalidateQueries({ queryKey })
    )
  }, [applyHistoryEntry, queryClient, queryKey, redo])

  if (!data) {
    return null
  }

  const publishedDate = data.episode.publishedAt
    ? formatDate(data.episode.publishedAt)
    : "-"
  const subtitle = [data.episode.displayEpisodeNumber, publishedDate]
    .filter(Boolean)
    .join(" • ")
  const replacementEpisodeVideo = getReplacementEpisodeVideo(
    data.episodeVideoAssets,
    data.mainMediaAsset?.id
  )

  return (
    <MotionConfig reducedMotion="user">
      <section className="mx-auto min-h-full max-w-[1232px]">
        <div
          className="flex max-w-[616px] flex-col gap-4"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-500">
            <ArrowLeft className="size-4" />
            Ads
          </p>
          <h1 className="text-balance text-3xl font-bold text-zinc-800">
            {data.episode.title}
          </h1>
          {subtitle ? (
            <p className="text-base font-semibold text-zinc-500">{subtitle}</p>
          ) : null}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 min-[1400px]:grid-cols-[minmax(22rem,26rem)_minmax(0,1fr)]">
          <MarkerPanel
            markers={displayedMarkers}
            selectedMarkerId={selectedMarkerId}
            savingMarkerIds={savingMarkerIds}
            deletingMarkerId={deletingMarkerId}
            isAutoPlacing={isAutoPlacing}
            isApplyingHistory={isApplyingHistory}
            createMarkerDisabledReason={createMarkerDisabledReason}
            onEdit={openEditDialog}
            onDelete={deleteMarker}
            onCreateMarker={openCreateDialog}
            onAutomaticallyPlace={autoPlaceMarkers}
            onActivateMarker={activateMarker}
          />
          <PlaybackSection
            key={data.mainMediaAsset?.id ?? "missing-main-media"}
            episodeId={episodeId}
            hlsBaseUrl={hlsBaseUrl}
            episodeDurationMs={data.episode.durationMs}
            mainMediaAsset={data.mainMediaAsset}
            transcriptJob={data.transcriptJob}
            replacementEpisodeVideo={replacementEpisodeVideo}
            uploadError={uploadErrorByTarget.episode}
            videoUploadProgress={
              replacementEpisodeVideo
                ? uploadProgressByMediaAssetId[replacementEpisodeVideo.mediaAsset.id]
                : undefined
            }
            canResetDemo={data.canResetDemo}
            isResettingDemo={isResettingDemo}
            markers={displayedMarkers}
            previewConfigKey={previewConfigKey}
            markerActivation={markerActivation}
            selectedMarkerId={selectedMarkerId}
            canUndo={canUndo}
            canRedo={canRedo}
            onMarkerTimeCommit={queueMarkerSave}
            onActivateMarker={activateMarker}
            onSelectMarker={selectMarker}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onDisplayTimeChange={setTimelineTimeMs}
            onAddEpisodeVideo={addEpisodeVideo}
            onResetDemo={resetDemo}
            onRemoveEpisodeVideo={removeEpisodeVideo}
            onSelectEpisodeVideo={selectEpisodeVideo}
          />
        </div>

        <MarkerDialog
          adLibrary={data.adLibrary}
          isSaving={isSavingDialog}
          markerDialogState={markerDialogState}
          uploadError={uploadErrorByTarget.ad}
          uploadProgressByMediaAssetId={uploadProgressByMediaAssetId}
          onClose={closeDialog}
          onConfirm={confirmDialog}
          onContinue={continueDialog}
          onDraftChange={setDialogDraft}
          onSelectionModeChange={setDialogSelectionMode}
          onUploadAds={uploadAds}
        />
      </section>
    </MotionConfig>
  )
}
