import type { Transcript, TranscriptSegment } from "./types"

const WORD_DURATION_MS = 320
const WORD_GAP_MS = 50
const SEGMENT_GAP_MS = 700

const buildSegment = (
  id: string,
  startMs: number,
  text: string
): TranscriptSegment => {
  const words = text.split(/\s+/).filter(Boolean)
  const transcriptWords = words.map((word, index) => {
    const wordStart = startMs + index * (WORD_DURATION_MS + WORD_GAP_MS)
    return {
      startMs: wordStart,
      endMs: wordStart + WORD_DURATION_MS,
      text: word,
    }
  })
  const lastWord = transcriptWords[transcriptWords.length - 1]

  return {
    id,
    startMs,
    endMs: lastWord.endMs,
    words: transcriptWords,
  }
}

const chainSegments = (texts: string[]): TranscriptSegment[] => {
  const segments: TranscriptSegment[] = []
  let cursorMs = 0

  for (const [index, text] of texts.entries()) {
    const segment = buildSegment(`segment-${index + 1}`, cursorMs, text)
    segments.push(segment)
    cursorMs = segment.endMs + SEGMENT_GAP_MS
  }

  return segments
}

const SEGMENT_TEXTS: string[] = [
  "Welcome back to The Diary Of A CEO. Today we're talking about Artemis Two, and why this mission matters more than anyone is telling you.",
  "Thanks for having me, Steven. It's the first crewed lunar flight in over fifty years. That alone deserves attention.",
  "Fifty years. Let that sink in. Most of the people working on this were not alive when Apollo ended.",
  "Right, and that's what makes the engineering so interesting. They're not picking up where Apollo stopped. They're rebuilding the capability almost from scratch.",
  "Tell me about the crew. Four people. Who are they and what's their job once they're out there?",
  "Four astronauts, three from NASA and one from the Canadian Space Agency. Their job is a flyby, not a landing. They loop the moon and come home.",
  "So no boots on the surface this time.",
  "Not yet. That's Artemis Three. This mission is about proving the transport stack works with people inside it before we commit to a landing.",
  "And the transport stack is the new rocket and capsule.",
  "The Space Launch System rocket, and the Orion capsule on top. First integrated test flight with a crew. Everything downstream depends on it going well.",
  "What's the thing you'll be watching most closely on launch day?",
  "Honestly? Re-entry. Getting out is hard. Getting back through the atmosphere at lunar return speeds is harder. That's what Artemis One tested, and that's what Artemis Two will actually trust.",
]

export const getDemoTranscript = (): Transcript => {
  return {
    status: "ready",
    segments: chainSegments(SEGMENT_TEXTS),
  }
}
