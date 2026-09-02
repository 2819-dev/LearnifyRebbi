type MicCallbacks = {
  onFinal: (text: string) => void
  onPartial?: (text: string) => void
  onError?: (message: string) => void
}

type RecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => RecognitionLike
    webkitSpeechRecognition?: new () => RecognitionLike
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function micSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(getRecognitionCtor())
}

export function looksHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text)
}

/** iOS puts SpeechRecognition into a phone-call audio session. */
export function isLikelyIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
}

/**
 * Student mic — on demand only.
 * Continuous listening keeps iPhone in “call” mode (call volume UI + mute chirps)
 * and often silences Rebbe speech. We only open the mic when we truly need it.
 */
export class StudentMic {
  private recognition: RecognitionLike | null = null
  private wanted = false
  private lang: 'en-US' | 'he-IL' = 'en-US'

  setLang(lang: 'en-US' | 'he-IL') {
    this.lang = lang
  }

  isActive() {
    return this.wanted && Boolean(this.recognition)
  }

  start(callbacks: MicCallbacks) {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      callbacks.onError?.(
        'This browser cannot listen. Try Chrome on desktop.',
      )
      return
    }

    this.abortHard()
    this.wanted = true
    const recognition = new Ctor()
    this.recognition = recognition
    // Non-continuous: one utterance, then ends — releases call-audio sooner on iOS.
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = this.lang

    recognition.onresult = (event) => {
      let finalText = ''
      let partial = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript.trim()
        if (!piece) continue
        if (event.results[i].isFinal) finalText += `${piece} `
        else partial += `${piece} `
      }
      if (partial) callbacks.onPartial?.(partial.trim())
      if (finalText.trim()) {
        const spoken = finalText.trim()
        if (looksHebrew(spoken)) this.lang = 'he-IL'
        callbacks.onFinal(spoken)
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      if (event.error === 'not-allowed') {
        callbacks.onError?.(
          'Allow the microphone so you can speak to the Rebbe.',
        )
        this.wanted = false
      }
    }

    recognition.onend = () => {
      // If still wanted (listening for a repeat), restart once after a beat.
      if (this.wanted && this.recognition === recognition) {
        window.setTimeout(() => {
          if (!this.wanted || this.recognition !== recognition) return
          try {
            recognition.lang = this.lang
            recognition.start()
          } catch {
            // ignore
          }
        }, 280)
      }
    }

    try {
      recognition.start()
    } catch (err) {
      callbacks.onError?.(
        err instanceof Error ? err.message : 'Could not start the microphone.',
      )
    }
  }

  /** Fully kill recognition so iOS can leave call-audio mode. */
  abortHard() {
    this.wanted = false
    const rec = this.recognition
    if (rec) {
      try {
        rec.onend = null
        rec.abort()
      } catch {
        // ignore
      }
    }
    this.recognition = null
  }

  stop() {
    this.abortHard()
  }
}
