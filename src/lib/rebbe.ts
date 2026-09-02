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
let currentSource: AudioBufferSourceNode | null = null
let currentHtmlAudio: HTMLAudioElement | null = null
let unlocked = false

const KIND_SET = new Set<HighlightKind>(['reading', 'term', 'rashi', 'focus'])

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

/** Must run inside a click/tap handler so speakers are allowed. */
export async function unlockAudio(): Promise<void> {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  const buffer = ctx.createBuffer(1, 1, 22050)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start(0)

  // Also unlock browser speech — needed when Gemini TTS falls back.
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel()
      const warm = new SpeechSynthesisUtterance(' ')
      warm.volume = 0
      warm.rate = 2
      window.speechSynthesis.speak(warm)
      window.speechSynthesis.getVoices()
    } catch {
      // ignore
    }
  }

  unlocked = true
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
  if (currentHtmlAudio) {
    currentHtmlAudio.pause()
    currentHtmlAudio.src = ''
    currentHtmlAudio = null
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
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

  const female = /female|zira|susan|samantha|karen|moira|tessa|fiona|victoria|siri|jenny|aria|sara|helen|hazel/i
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

function estimateSpeechMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1400, Math.round((words / 2.4) * 1000))
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
  onDuration?.(estimateSpeechMs(text))

  await new Promise<void>((resolve) => {
    let started = false
    const speakNow = () => {
      if (started) return
      started = true
      const utter = new SpeechSynthesisUtterance(text)
      const voice = pickBrowserVoice(lang)
      if (voice) utter.voice = voice
      if (lang) utter.lang = lang
      const isHe = Boolean(lang?.startsWith('he'))
      utter.rate = rate ?? (isHe ? 0.78 : 0.9)
      // Slightly lower pitch reads as a calm adult man on most engines.
      utter.pitch = pitch ?? (isHe ? 0.9 : 0.85)
      utter.volume = 1
      utter.onend = () => {
        resolve()
        onend?.()
      }
      utter.onerror = () => {
        resolve()
        onend?.()
      }
      window.speechSynthesis.speak(utter)
    }
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => speakNow()
      window.speechSynthesis.getVoices()
      setTimeout(speakNow, 180)
    } else {
      speakNow()
    }
  })
}

export async function playBase64Audio(
  audio: SpeakPayload,
  handlers?: PlayHandlers | (() => void),
): Promise<void> {
  const onend = typeof handlers === 'function' ? handlers : handlers?.onend
  const onDuration =
    typeof handlers === 'function' ? undefined : handlers?.onDuration

  if (audio.source === 'browser' || audio.mimeType === 'browser') {
    await playBrowserSpeech(audio.text || '', { onend, onDuration })
    return
  }

  stopSpeaking()

  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  if (!unlocked) {
    await unlockAudio()
  }

  try {
    const arrayBuffer = base64ToArrayBuffer(audio.audioBase64)
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0))
    onDuration?.(Math.max(800, Math.round(decoded.duration * 1000)))
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    gain.gain.value = 1
    source.buffer = decoded
    source.connect(gain)
    gain.connect(ctx.destination)
    currentSource = source
    source.onended = () => {
      if (currentSource === source) currentSource = null
      onend?.()
    }
    source.start(0)
    return
  } catch (err) {
    console.warn('AudioContext playback failed, trying HTMLAudioElement', err)
  }

  const url = `data:${audio.mimeType};base64,${audio.audioBase64}`
  const el = new Audio(url)
  el.volume = 1
  currentHtmlAudio = el
  el.onloadedmetadata = () => {
    if (Number.isFinite(el.duration) && el.duration > 0) {
      onDuration?.(Math.max(800, Math.round(el.duration * 1000)))
    } else if (audio.text) {
      onDuration?.(estimateSpeechMs(audio.text))
    }
  }
  el.onended = () => {
    if (currentHtmlAudio === el) currentHtmlAudio = null
    onend?.()
  }
  el.onerror = () => {
    if (currentHtmlAudio === el) currentHtmlAudio = null
    onend?.()
  }
  try {
    await el.play()
  } catch (err) {
    currentHtmlAudio = null
    if (audio.text) {
      await playBrowserSpeech(audio.text, { onend, onDuration })
      return
    }
    throw new Error(
      err instanceof Error
        ? `Could not play sound: ${err.message}`
        : 'Could not play sound through your speakers.',
    )
  }
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
  const res = await fetch('/api/rebbe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Rebbe is unavailable right now.')
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

export async function speakAgain(
  text: string,
  voice: string,
): Promise<SpeakPayload> {
  const res = await fetch('/api/rebbe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
