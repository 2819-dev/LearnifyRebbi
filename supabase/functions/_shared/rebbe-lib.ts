import { curriculum } from './curriculum.ts'
import { setting } from './db.ts'
import { httpError } from './http.ts'
import { trainingHintsForPrompt } from './hints.ts'

export const SYSTEM_PROMPT = "You are a warm, professional male Rebbi tutoring ONE Jewish child (about 9\u201314) in Guide.\n\nNever speak to a class. Never say everyone or sit down.\n\nVOICE:\n- Calm adult man. Clear. Kind. Not theatrical.\n- English is the main language.\n- Pronounce Hebrew carefully and correctly when you say Hebrew words.\n\nTEACH / CONTINUE PEDAGOGY (important):\n1) Pick a short chunk from the Gemara line \u2014 about 2 to 4 words (not one isolated word unless it is a key term alone).\n2) The student will hear: Hebrew chunk \u2192 English meaning \u2192 then they repeat.\n3) After they repeat, you give a tiny explanation (1\u20132 sentences).\n\nASK MODE:\n- Answer briefly and clearly.\n\nSTRICT ACCURACY:\n- Use ONLY the Gemara line, Rashi/Tosafot provided, and curriculum notes.\n- No invented meforshim. No practical real-life psak.\n\nOUTPUT \u2014 ONLY valid JSON:\n{\n  \"welcome\": \"empty string usually; one short welcome only if asked\",\n  \"hebrew\": \"2\u20134 Hebrew words from the line\",\n  \"english\": \"plain English meaning of that chunk\",\n  \"explain\": \"1\u20132 spoken sentences after the student repeats\",\n  \"speech\": \"for ask/continue free talk: what you say out loud; otherwise empty\",\n  \"highlights\": [\n    { \"word\": \"Hebrew word from the line\", \"kind\": \"term|rashi|focus|reading\" }\n  ]\n}\nKeep every spoken field short. Prefer 1\u20133 highlights."

export const REBBE_VOICES = [
  { id: 'Charon', label: 'Teacher', blurb: 'Warm, clear man.' },
  { id: 'Sadaltager', label: 'Steady', blurb: 'Patient adult man.' },
  { id: 'Schedar', label: 'Even', blurb: 'Calm measured man.' },
  { id: 'Gacrux', label: 'Warm', blurb: 'Gentle soft man.' },
]

export type ChatMessage = { role?: string; content?: string }

export type LessonPayload = {
  welcome: string
  hebrew: string
  english: string
  explain: string
  speech: string
  highlights: { word: string; kind: string }[]
}

export function clip(text: unknown, max = 420): string {
  const s = String(text || '').trim()
  if (s.length <= max) return s
  return (s.slice(0, max)) + "\u2026"
}

export function buildCurriculumBlock(): string {
  return [
    "Topic: " + (curriculum.title),
    "Overview: " + (curriculum.overview),
    'Key ideas:',
    ...curriculum.concepts
      .slice(0, 4)
      .map((x) => "- " + (x.term) + ": " + (x.kidExplanation)),
  ].join('\n')
}

export async function geminiKey(): Promise<string> {
  return Deno.env.get('GEMINI_API_KEY') || (await setting('gemini_api_key')) || ''
}

export async function groqKey(): Promise<string> {
  return Deno.env.get('GROQ_API_KEY') || (await setting('groq_api_key')) || ''
}

export async function geminiModel(): Promise<string> {
  return (
    Deno.env.get('GEMINI_MODEL') ||
    (await setting('gemini_model')) ||
    'gemini-3.1-flash-lite'
  )
}

export async function ttsModel(): Promise<string> {
  return (
    Deno.env.get('GEMINI_TTS_MODEL') ||
    (await setting('gemini_tts_model')) ||
    'gemini-2.5-flash-preview-tts'
  )
}

/** Alternate Gemini TTS models — separate free-tier buckets when the primary is exhausted. */
export async function ttsModelCandidates(): Promise<string[]> {
  const primary = await ttsModel()
  const alts = [
    primary,
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-pro-preview-tts',
    'gemini-2.5-flash-tts',
  ]
  return [...new Set(alts.filter(Boolean))]
}

/** Map Guide voice ids → Groq Orpheus male voices. */
export function groqVoiceFor(guideVoice: string): string {
  const map: Record<string, string> = {
    Charon: 'troy',
    Sadaltager: 'austin',
    Schedar: 'daniel',
    Gacrux: 'aaron',
  }
  return map[guideVoice] || 'troy'
}

export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < tries; i += 1) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const status = Number((err as { status?: number })?.status)
      const msg = String((err as { message?: string })?.message || '')
      const retryable =
        status === 429 ||
        status === 503 ||
        /high demand|quota|rate|unavailable|Resource exhausted/i.test(msg)
      if (!retryable || i === tries - 1) throw err
      const retryMatch = msg.match(/retry in ([\d.]+)\s*s/i)
      const suggested = retryMatch ? Number(retryMatch[1]) * 1000 : 0
      const wait = Math.min(20000, Math.max(600 * (i + 1) * (i + 1), suggested || 0))
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw lastErr
}

export function chunkHebrewFallback(hebrewLine = '', englishLine = '') {
  const words = String(hebrewLine).trim().split(/\s+/).filter(Boolean)
  const hebrew = words.slice(0, Math.min(3, Math.max(2, words.length))).join(' ')
  const english = clip(englishLine, 120) || 'Look carefully at these words.'
  return {
    hebrew,
    english,
    explain: hebrew
      ? 'Good. Keep those words in mind as we learn this line.'
      : 'Let us look at this line together.',
  }
}

export function parseLessonPayload(
  raw: string,
  hebrewLine = '',
  englishLine = '',
): LessonPayload {
  const text = String(raw || '').trim()
  const fallback = chunkHebrewFallback(hebrewLine, englishLine)
  try {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1))
      const highlights = Array.isArray(parsed.highlights)
        ? parsed.highlights
            .map((h: { word?: string; kind?: string }) => ({
              word: String(h.word || '').trim(),
              kind: ['reading', 'term', 'rashi', 'focus'].includes(String(h.kind))
                ? String(h.kind)
                : 'term',
            }))
            .filter((h: { word: string }) => h.word)
            .slice(0, 6)
        : []

      const hebrew = clip(parsed.hebrew || fallback.hebrew, 120)
      const english = clip(parsed.english || fallback.english, 160)
      const explain = clip(parsed.explain || fallback.explain, 280)
      const welcome = clip(parsed.welcome || '', 160)
      const speech = clip(
        parsed.speech ||
          [hebrew && "Hebrew: " + (hebrew), english && "That means: " + (english), explain]
            .filter(Boolean)
            .join(' '),
        700,
      )
      return { welcome, hebrew, english, explain, speech, highlights }
    }
  } catch {
    // fall through
  }
  return {
    welcome: '',
    hebrew: fallback.hebrew,
    english: fallback.english,
    explain: fallback.explain,
    speech: clip(text || fallback.explain, 700),
    highlights: [],
  }
}

