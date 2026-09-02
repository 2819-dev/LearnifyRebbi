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

let currentAudio: HTMLAudioElement | null = null

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
}

export function playBase64Audio(
  audio: SpeakPayload,
  onend?: () => void,
): HTMLAudioElement {
  stopSpeaking()
  const url = `data:${audio.mimeType};base64,${audio.audioBase64}`
  const el = new Audio(url)
  currentAudio = el
  el.onended = () => {
    if (currentAudio === el) currentAudio = null
    onend?.()
  }
  el.onerror = () => {
    if (currentAudio === el) currentAudio = null
    onend?.()
  }
  void el.play()
  return el
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
  return data as SpeakPayload
}
