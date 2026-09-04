import { GUIDE_ANON_KEY, GUIDE_FUNCTIONS } from './guide-backend'
import type { HighlightKind } from './curriculum'

export type ChatMessage = {
  role: 'user' | 'model'
  content: string
}

export type SpeakPayload = {
  mimeType: string
  audioBase64: string
  voice: string
  source?: string
  text?: string
  warning?: string
}

export type TextHighlight = {
  word: string
  kind: HighlightKind
}

export type RebbeResponse = {
  reply: string
  highlights: TextHighlight[]
  welcome?: string
  hebrew?: string
  english?: string
  explain?: string
  audio?: SpeakPayload | null
}

export type PlayHandlers = {
  onend?: () => void
  onDuration?: (durationMs: number) => void
}

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}

let audioCtx: AudioContext | null = null
/** Persistent element unlocked inside a user gesture — required for iOS speakers. */
let unlockedAudioEl: HTMLAudioElement | null = null
let currentSource: AudioBufferSourceNode | null = null
let currentObjectUrl: string | null = null
let unlocked = false

const KIND_SET = new Set<HighlightKind>(['reading', 'term', 'rashi', 'focus'])
const ttsCache = new Map<string, SpeakPayload>()
const ttsInflight = new Map<string, Promise<SpeakPayload>>()

const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

function normalizeHighlights(raw: unknown): TextHighlight[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const row = item as { word?: string; kind?: string }
      const word = String(row.word || '').trim()
      const kind = KIND_SET.has(row.kind as HighlightKind)
        ? (row.kind as HighlightKind)
        : 'term'
      return word ? { word, kind } : null
    })
    .filter((h): h is TextHighlight => Boolean(h))
    .slice(0, 8)
}

function getAudioContext(): AudioContext {
  if (audioCtx) return audioCtx
  const w = window as AudioWindow
  const Ctx = window.AudioContext || w.webkitAudioContext
  if (!Ctx) {
    throw new Error('This browser cannot play sound.')
  }
  audioCtx = new Ctx()
  return audioCtx
}

function ensureUnlockedAudioEl(): HTMLAudioElement {
  if (unlockedAudioEl) return unlockedAudioEl
  const el = new Audio()
  el.setAttribute('playsinline', 'true')
  el.setAttribute('webkit-playsinline', 'true')
  el.preload = 'auto'
  unlockedAudioEl = el
  return el
}

function ttsCacheKey(text: string, voice: string) {
  return `${voice}::${text}`
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

function estimateSpeechMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1400, Math.round((words / 2.4) * 1000))
}

function revokeCurrentObjectUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
}

/** Must run inside a click/tap handler so speakers are allowed. */
export async function unlockAudio(): Promise<void> {
  const el = ensureUnlockedAudioEl()
  el.muted = false
  el.volume = 1
  el.src = SILENT_WAV
  try {
    await el.play()
  } catch {
    // Still mark unlocked — AudioContext path may work.
  }
  try {
    el.pause()
    el.currentTime = 0
  } catch {
    // ignore
  }

  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.getVoices()
    } catch {
      // ignore
    }
  }

  unlocked = true
}

export async function reclaimPlaybackRoute(): Promise<void> {
  try {
    const el = ensureUnlockedAudioEl()
    const prev = el.src
    el.src = SILENT_WAV
    el.volume = 0.01
    await el.play()
    el.pause()
    el.currentTime = 0
    el.volume = 1
    if (prev && prev !== SILENT_WAV) el.src = prev
  } catch {
    // ignore
  }
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
  } catch {
    // ignore
  }
}

export function isAudioUnlocked(): boolean {
  return unlocked
}

export function stopSpeaking() {
  try {
    currentSource?.stop()
  } catch {
    // already stopped
  }
  currentSource = null
  if (unlockedAudioEl) {
    try {
      unlockedAudioEl.onended = null
      unlockedAudioEl.onerror = null
      unlockedAudioEl.pause()
      // Keep the element itself — iOS needs the gesture-unlocked instance.
    } catch {
      // ignore
    }
  }
  revokeCurrentObjectUrl()
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

function pickBrowserVoice(lang?: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  const wantHe = lang?.toLowerCase().startsWith('he')
  if (wantHe) {
    return (
      voices.find((v) => /he-IL|hebrew/i.test(`${v.lang} ${v.name}`)) ||
      voices.find((v) => /^he(-|_)/i.test(v.lang)) ||
      null
    )
  }

  const female =
    /female|zira|susan|samantha|karen|moira|tessa|fiona|victoria|siri|jenny|aria|sara|helen|hazel/i
  const malePreferred = [
    /google uk english male/i,
    /microsoft (guy|davis|tony|mark|andrew|christopher|eric|george)/i,
    /\b(daniel|david|james|thomas|aaron|alex|fred|bruce|arthur)\b/i,
    /english male/i,
  ]
  const english = voices.filter(
    (v) => /^en(-|_)/i.test(v.lang) && !female.test(`${v.name} ${v.lang}`),
  )
  for (const pattern of malePreferred) {
    const hit = english.find((v) => pattern.test(`${v.name} ${v.lang}`))
    if (hit) return hit
  }
  return (
    english[0] ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
    null
  )
}

export type BrowserSpeechOptions = PlayHandlers & {
  lang?: string
  rate?: number
  pitch?: number
}

export async function playBrowserSpeech(
  text: string,
  handlers?: BrowserSpeechOptions | (() => void),
): Promise<void> {
  const opts = typeof handlers === 'function' ? { onend: handlers } : handlers || {}
  const { onend, onDuration, lang, rate, pitch } = opts

  if (typeof window === 'undefined' || !window.speechSynthesis) {
    throw new Error('No speaker voice available in this browser.')
  }
  stopSpeaking()
  const expected = estimateSpeechMs(text)
  onDuration?.(expected)

  await new Promise<void>((resolve, reject) => {
    let started = false
    let didStart = false
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(watchdog)
      if (ok) {
        onend?.()
        resolve()
      } else {
        reject(new Error('Could not play speech through speakers.'))
      }
    }

    const watchdog = window.setTimeout(() => {
      if (!didStart) finish(false)
    }, 1500)

    const speakNow = () => {
      if (started) return
      started = true
      const startedAt = Date.now()
      const utter = new SpeechSynthesisUtterance(text)
      const voice = pickBrowserVoice(lang)
      if (voice) utter.voice = voice
      if (lang) utter.lang = lang
      const isHe = Boolean(lang?.startsWith('he'))
      utter.rate = rate ?? (isHe ? 0.78 : 0.9)
      utter.pitch = pitch ?? (isHe ? 0.9 : 0.85)
      utter.volume = 1
      utter.onstart = () => {
        didStart = true
      }
      utter.onend = () => {
        const elapsed = Date.now() - startedAt
        finish(didStart && (elapsed > 350 || text.trim().length < 8))
      }
      utter.onerror = () => finish(false)
      try {
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(utter)
      } catch {
        finish(false)
      }
    }
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => speakNow()
      window.speechSynthesis.getVoices()
      setTimeout(speakNow, 200)
    } else {
      speakNow()
    }
  })
}

export async function speakAgain(
  text: string,
  voice: string,
): Promise<SpeakPayload> {
  const res = await fetch(GUIDE_FUNCTIONS.rebbe, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: GUIDE_ANON_KEY,
    },
    body: JSON.stringify({ action: 'speak', text, voice }),
  })
  const data = await res.json()
  if (!res.ok) {
    return {
      mimeType: 'browser',
      audioBase64: '',
      voice,
      source: 'browser',
      text,
      warning: data.error || 'Could not speak right now.',
    }
  }
  if (data?.source === 'browser' || data?.mimeType === 'browser') {
    return {
      ...data,
      text: data.text || text,
    } as SpeakPayload
  }
  if (!data?.audioBase64) {
    return {
      mimeType: 'browser',
      audioBase64: '',
      voice,
      source: 'browser',
      text,
    }
  }
  return { ...data, text } as SpeakPayload
}

/** Fetch Gemini WAV (cached). */
export async function fetchSpeech(
  text: string,
  voice: string,
): Promise<SpeakPayload | null> {
  const trimmed = text.trim()
  if (!trimmed) return null
  const key = ttsCacheKey(trimmed, voice)
  const cached = ttsCache.get(key)
  if (cached?.audioBase64 && cached.source !== 'browser') return cached

  const existing = ttsInflight.get(key)
  if (existing) return existing

  const promise = speakAgain(trimmed, voice)
    .then((audio) => {
      if (audio.audioBase64 && audio.source !== 'browser') {
        ttsCache.set(key, audio)
        return audio
      }
      return audio
    })
    .finally(() => {
      ttsInflight.delete(key)
    })
  ttsInflight.set(key, promise)
  return promise
}

/** Return cached Gemini WAV only (no network). */
export function peekSpeech(text: string, voice: string): SpeakPayload | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const cached = ttsCache.get(ttsCacheKey(trimmed, voice))
  if (cached?.audioBase64 && cached.source !== 'browser') return cached
  return null
}

export async function playBase64Audio(
  audio: SpeakPayload,
  handlers?: PlayHandlers | (() => void),
): Promise<void> {
  const onend = typeof handlers === 'function' ? handlers : handlers?.onend
  const onDuration =
    typeof handlers === 'function' ? undefined : handlers?.onDuration

  if (audio.source === 'browser' || audio.mimeType === 'browser' || !audio.audioBase64) {
    await playBrowserSpeech(audio.text || '', { onend, onDuration })
    return
  }

  stopSpeaking()

  const bytes = base64ToUint8Array(audio.audioBase64)
  const mime = audio.mimeType || 'audio/wav'
  const buffer = copyToArrayBuffer(bytes)
  const blob = new Blob([buffer], { type: mime })
  const url = URL.createObjectURL(blob)
  currentObjectUrl = url

  const el = ensureUnlockedAudioEl()
  el.muted = false
  el.volume = 1
  el.src = url

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finishOk = () => {
      if (settled) return
      settled = true
      onend?.()
      resolve()
    }
    const finishErr = (err: Error) => {
      if (settled) return
      settled = true
      reject(err)
    }

    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        onDuration?.(Math.max(800, Math.round(el.duration * 1000)))
      } else if (audio.text) {
        onDuration?.(estimateSpeechMs(audio.text))
      }
    }
    el.onended = finishOk
    el.onerror = () =>
      finishErr(new Error('Could not play sound through your speakers.'))

    void el.play().then(
      () => {
        // playing
      },
      async (err) => {
        // Fallback: AudioContext (works if unlocked in gesture)
        try {
          const ctx = getAudioContext()
          if (ctx.state === 'suspended') await ctx.resume()
          const decoded = await ctx.decodeAudioData(buffer.slice(0))
          onDuration?.(Math.max(800, Math.round(decoded.duration * 1000)))
          await new Promise<void>((res) => {
            const source = ctx.createBufferSource()
            const gain = ctx.createGain()
            gain.gain.value = 1
            source.buffer = decoded
            source.connect(gain)
            gain.connect(ctx.destination)
            currentSource = source
            source.onended = () => {
              if (currentSource === source) currentSource = null
              res()
            }
            source.start(0)
          })
          finishOk()
        } catch {
          finishErr(
            err instanceof Error
              ? new Error(`Could not play sound: ${err.message}`)
              : new Error('Could not play sound through your speakers.'),
          )
        }
      },
    )
  })
}

/**
 * Speak with the Rebbi: always prefer real Gemini WAV through the unlocked
 * audio element. Browser speechSynthesis is last-resort only — it often
 * "succeeds" while staying silent on phones.
 */
export async function speakTextAudibly(
  text: string,
  voice: string,
  handlers?: BrowserSpeechOptions,
): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return

  const audio = await fetchSpeech(trimmed, voice)
  if (audio?.audioBase64 && audio.source !== 'browser') {
    await playBase64Audio(audio, handlers)
    return
  }

  await playBrowserSpeech(trimmed, handlers)
}

export async function askRebbe(payload: {
  messages: ChatMessage[]
  gemaraRef: string
  hebrewLine: string
  englishLine: string
  lineIndex: number
  mode: 'teach' | 'continue' | 'ask'
  question?: string
  voice: string
  rashiForLine?: string
  tosafotForLine?: string
  needWelcome?: boolean
  includeSpeech?: boolean
}): Promise<RebbeResponse> {
  const res = await fetch(GUIDE_FUNCTIONS.rebbe, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: GUIDE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Rebbi is unavailable right now.')
  }
  return {
    reply: String(data.reply || data.explain || ''),
    welcome: String(data.welcome || ''),
    hebrew: String(data.hebrew || ''),
    english: String(data.english || ''),
    explain: String(data.explain || ''),
    highlights: normalizeHighlights(data.highlights),
    audio:
      data.audio?.audioBase64 || data.audio?.source === 'browser'
        ? (data.audio as SpeakPayload)
        : null,
  }
}
