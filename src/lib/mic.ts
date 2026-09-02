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

/** Detect mostly Hebrew so we can restart recognition in he-IL when needed. */
export function looksHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text)
}

export class StudentMic {
  private recognition: RecognitionLike | null = null
  private wanted = false
  private paused = false
  private lang: 'en-US' | 'he-IL' = 'en-US'
  private callbacks: MicCallbacks | null = null

  setLang(lang: 'en-US' | 'he-IL') {
    if (this.lang === lang) return
    this.lang = lang
    if (this.wanted && !this.paused) {
      this.start(this.callbacks || { onFinal: () => undefined })
    }
  }

  start(callbacks: MicCallbacks) {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      callbacks.onError?.(
        'This browser cannot listen. Try Chrome on desktop.',
      )
      return
    }

    this.callbacks = callbacks
    this.stop()
    this.wanted = true
    this.paused = false
    const recognition = new Ctor()
    this.recognition = recognition
    recognition.continuous = true
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
      if (this.wanted && !this.paused) {
        try {
          recognition.lang = this.lang
          recognition.start()
        } catch {
          // ignore restart races
        }
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

  pause() {
    this.paused = true
    try {
      this.recognition?.stop()
    } catch {
      // ignore
    }
  }

  resume() {
    if (!this.wanted || !this.recognition) return
    this.paused = false
    try {
      this.recognition.lang = this.lang
      this.recognition.start()
    } catch {
      // ignore
    }
  }

  stop() {
    this.wanted = false
    this.paused = false
    try {
      this.recognition?.abort()
    } catch {
      // ignore
    }
    this.recognition = null
  }
}
