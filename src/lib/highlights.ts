import type { HighlightKind } from './curriculum'
import type { TextHighlight } from './rebbe'

export type ActiveHighlights = {
  readingIndex: number | null
  marks: TextHighlight[]
}

export function splitHebrewWords(line: string): string[] {
  return line.split(/(\s+)/).filter((part) => part.length > 0)
}

function normalizeToken(value: string): string {
  return value.replace(/[^\u0590-\u05FFa-zA-Z]/g, '').toLowerCase()
}

export function markWordKinds(
  words: string[],
  marks: TextHighlight[],
): Array<HighlightKind | null> {
  const kinds: Array<HighlightKind | null> = words.map(() => null)
  for (const mark of marks) {
    if (mark.kind === 'reading') continue
    const needle = normalizeToken(mark.word)
    if (!needle) continue
    const idx = words.findIndex((w) => {
      const token = normalizeToken(w)
      return token === needle || token.includes(needle) || needle.includes(token)
    })
    if (idx >= 0) kinds[idx] = mark.kind
  }
  return kinds
}

/** Real words only (skip whitespace chunks) for reading walk. */
export function realWordIndexes(parts: string[]): number[] {
  return parts
    .map((part, i) => ({ part, i }))
    .filter(({ part }) => /\S/.test(part) && /[\u0590-\u05FFa-zA-Z]/.test(part))
    .map(({ i }) => i)
}

/** Walk reading highlight across words while audio plays. */
export function runReadingWalk(
  wordCount: number,
  durationMs: number,
  onIndex: (index: number | null) => void,
): () => void {
  if (wordCount <= 0) {
    onIndex(null)
    return () => undefined
  }
  const step = Math.max(160, Math.floor(durationMs / Math.max(wordCount, 1)))
  let i = 0
  onIndex(0)
  const timer = window.setInterval(() => {
    i += 1
    if (i >= wordCount) {
      window.clearInterval(timer)
      onIndex(null)
      return
    }
    onIndex(i)
  }, step)
  return () => {
    window.clearInterval(timer)
    onIndex(null)
  }
}

/** Fallback marks from curriculum terms found in the Hebrew line. */
export function fallbackHighlights(
  hebrewLine: string,
  terms: string[],
): TextHighlight[] {
  const line = hebrewLine.toLowerCase()
  const out: TextHighlight[] = []
  for (const term of terms) {
    const t = term.trim()
    if (!t) continue
    if (line.includes(t.toLowerCase()) || hebrewLine.includes(t)) {
      out.push({ word: t, kind: 'term' })
    }
    if (out.length >= 3) break
  }
  return out
}
