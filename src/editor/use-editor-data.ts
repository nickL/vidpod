"use client"

import { useQuery } from "@tanstack/react-query"

import { episodeEditorQueryOptions } from "./queries"

export const useEditorData = (episodeId: string) => {
  return useQuery(episodeEditorQueryOptions(episodeId))
}
