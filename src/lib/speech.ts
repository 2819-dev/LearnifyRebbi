export type VoiceOption = {
  id: string
  name: string
  lang: string
  voice: SpeechSynthesisVoice
}

export function listEnglishVoices(): VoiceOption[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  const voices = window.speechSynthesis.getVoices()
  return voices
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .map((v) => ({
      id: `${v.name}::${v.lang}`,
      name: v.name.replace(/Microsoft |Google |Apple /g, ''),
      lang: v.lang,
      voice: v,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function speakText(
  text: string,
  voice: SpeechSynthesisVoice | null,
  opts?: { rate?: number; pitch?: number; onend?: () => void },
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  if (voice) utter.voice = voice
  utter.rate = opts?.rate ?? 0.95
  utter.pitch = opts?.pitch ?? 1
  utter.lang = voice?.lang || 'en-US'
  if (opts?.onend) utter.onend = opts.onend
  window.speechSynthesis.speak(utter)
}

export function stopSpeaking() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
}
