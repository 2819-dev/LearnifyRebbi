export type ChatMessage = {
  role: 'user' | 'model'
  content: string
}

export type SpeakPayload = {
  mimeType: string
  audioBase64: string
  voice: string
}

export type RebbeResponse = {
  reply: string
}

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}

let audioCtx: AudioContext | null = null
let currentSource: AudioBufferSourceNode | null = null
let currentHtmlAudio: HTMLAudioElement | null = null
let unlocked = false

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
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export async function playBase64Audio(
  audio: SpeakPayload,
  onend?: () => void,
): Promise<void> {
  stopSpeaking()

  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  if (!unlocked) {
    // Last-chance unlock; may still fail without a gesture.
    await unlockAudio()
  }

  try {
    const arrayBuffer = base64ToArrayBuffer(audio.audioBase64)
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0))
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

  // Fallback path
  const url = `data:${audio.mimeType};base64,${audio.audioBase64}`
  const el = new Audio(url)
  el.volume = 1
  currentHtmlAudio = el
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
    reply: String(data.reply || ''),
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
    throw new Error(data.error || 'Could not speak right now.')
  }
  if (!data?.audioBase64) {
    throw new Error('No sound came back from the Rebbe.')
  }
  return data as SpeakPayload
}
