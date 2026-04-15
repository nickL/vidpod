export type TranscriptWord = {
  word: string
  start: number
  end: number
}

export type TranscriptChunkResult = {
  chunkIndex: number
  durationMs: number
  startMs: number
  text: string
  words: TranscriptWord[]
}

const trimChunkWords = (
  result: TranscriptChunkResult,
  chunkOffsetSeconds: number,
  overlapTrimSeconds: number
) =>
  result.words.flatMap((word) => {
    if (word.end <= overlapTrimSeconds) {
      return []
    }

    return [
      {
        word: word.word,
        start: Math.max(word.start, overlapTrimSeconds) + chunkOffsetSeconds,
        end: word.end + chunkOffsetSeconds,
      },
    ]
  })

const readChunkText = (
  result: TranscriptChunkResult,
  chunkWords: TranscriptWord[]
) => {
  if (chunkWords.length > 0) {
    return chunkWords.map((word) => word.word).join(" ").trim()
  }

  if (result.words.length === 0 && result.text.trim()) {
    throw new Error("Transcript chunk is missing word timings.")
  }

  return ""
}

export const mergeTranscriptResults = (
  results: TranscriptChunkResult[],
  chunkOverlapMs: number
) => {
  const sortedResults = [...results].sort(
    (left, right) => left.chunkIndex - right.chunkIndex
  )
  const words: TranscriptWord[] = []
  const textParts: string[] = []

  for (const result of sortedResults) {
    const chunkOffsetSeconds = result.startMs / 1000
    const overlapTrimSeconds =
      result.chunkIndex === 0 ? 0 : chunkOverlapMs / 1000
    const chunkWords = trimChunkWords(
      result,
      chunkOffsetSeconds,
      overlapTrimSeconds
    )

    words.push(...chunkWords)

    const chunkText = readChunkText(result, chunkWords)

    if (chunkText) {
      textParts.push(chunkText)
    }
  }

  return {
    text: textParts.join(" ").trim(),
    words,
  }
}
