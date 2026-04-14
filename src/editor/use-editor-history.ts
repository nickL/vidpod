"use client"

import { useCallback, useState } from "react"

import type { MarkerHistoryEntry } from "./markers/history"

type HistoryDirection = "undo" | "redo"

type ApplyHistoryEntry = (
  change: MarkerHistoryEntry,
  direction: HistoryDirection
) => Promise<void>

export const useEditorHistory = () => {
  const [undoStack, setUndoStack] = useState<MarkerHistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<MarkerHistoryEntry[]>([])
  const [isApplyingHistory, setIsApplyingHistory] = useState(false)

  const push = useCallback((change: MarkerHistoryEntry) => {
    setUndoStack((currentStack) => [...currentStack, change])
    setRedoStack([])
  }, [])

  const undo = useCallback(
    async (apply: ApplyHistoryEntry, onSuccess?: () => void | Promise<void>) => {
      const change = undoStack[undoStack.length - 1]

      if (!change || isApplyingHistory) {
        return
      }

      setIsApplyingHistory(true)

      try {
        setUndoStack((currentStack) => currentStack.slice(0, -1))
        await apply(change, "undo")
        setRedoStack((currentStack) => [...currentStack, change])
        await onSuccess?.()
      } catch {
        setUndoStack((currentStack) => [...currentStack, change])
      } finally {
        setIsApplyingHistory(false)
      }
    },
    [isApplyingHistory, undoStack]
  )

  const redo = useCallback(
    async (apply: ApplyHistoryEntry, onSuccess?: () => void | Promise<void>) => {
      const change = redoStack[redoStack.length - 1]

      if (!change || isApplyingHistory) {
        return
      }

      setIsApplyingHistory(true)

      try {
        setRedoStack((currentStack) => currentStack.slice(0, -1))
        await apply(change, "redo")
        setUndoStack((currentStack) => [...currentStack, change])
        await onSuccess?.()
      } catch {
        setRedoStack((currentStack) => [...currentStack, change])
      } finally {
        setIsApplyingHistory(false)
      }
    },
    [isApplyingHistory, redoStack]
  )

  return {
    hasUndo: undoStack.length > 0,
    hasRedo: redoStack.length > 0,
    isApplyingHistory,
    push,
    undo,
    redo,
  }
}
