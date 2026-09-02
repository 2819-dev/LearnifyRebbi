import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import curriculum from '../data/hashavas-aveidah.json'
import { askRebbe, type ChatMessage } from '../lib/rebbe'
import {
  defaultStartIndex,
  fetchGemaraPage,
  type GemaraPage,
} from '../lib/sefaria'
import {
  listEnglishVoices,
  speakText,
  stopSpeaking,
  type VoiceOption,
} from '../lib/speech'

type Props = {
  daf: string
  voiceId: string | null
  onExit: () => void
  onVoiceIdChange: (id: string | null) => void
}

export function LearningRoom({
  daf,
  voiceId,
  onExit,
  onVoiceIdChange,
}: Props) {
  const [page, setPage] = useState<GemaraPage | null>(null)
  const [lineIndex, setLineIndex] = useState(0)
  const [loadingPage, setLoadingPage] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const feedRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const pageRef = useRef<GemaraPage | null>(null)
  const lineRef = useRef(0)
  const requestIdRef = useRef(0)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const selectedVoice = useMemo(
    () => voices.find((v) => v.id === voiceId)?.voice ?? voices[0]?.voice ?? null,
    [voices, voiceId],
  )

  useEffect(() => {
    voiceRef.current = selectedVoice
  }, [selectedVoice])

  useEffect(() => {
    pageRef.current = page
  }, [page])

  useEffect(() => {
    lineRef.current = lineIndex
  }, [lineIndex])

  useEffect(() => {
    const refresh = () => setVoices(listEnglishVoices())
    refresh()
    window.speechSynthesis?.addEventListener('voiceschanged', refresh)
    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', refresh)
      stopSpeaking()
    }
  }, [])

  async function teachCurrentLine() {
    const current = pageRef.current
    if (!current) return
    const id = ++requestIdRef.current
    const idx = lineRef.current
    setBusy(true)
    setError(null)
    setMessages([])
    try {
      const reply = await askRebbe({
        messages: [],
        gemaraRef: current.ref,
        hebrewLine: current.hebrew[idx] || '',
        englishLine: current.english[idx] || '',
        lineIndex: idx,
        mode: 'teach',
      })
      if (id !== requestIdRef.current) return
      setMessages([{ role: 'model', content: reply }])
      setSpeaking(true)
      speakText(reply, voiceRef.current, {
        onend: () => {
          if (id === requestIdRef.current) setSpeaking(false)
        },
      })
    } catch (err) {
      if (id !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      if (id === requestIdRef.current) setBusy(false)
    }
  }

  async function runFollowUp(mode: 'continue' | 'ask', q?: string) {
    const current = pageRef.current
    if (!current || busy) return
    const id = ++requestIdRef.current
    const idx = lineRef.current
    setBusy(true)
    setError(null)
    try {
      const prior = messagesRef.current
      const reply = await askRebbe({
        messages: prior,
        gemaraRef: current.ref,
        hebrewLine: current.hebrew[idx] || '',
        englishLine: current.english[idx] || '',
        lineIndex: idx,
        mode,
        question: q,
      })
      if (id !== requestIdRef.current) return
      const next: ChatMessage[] =
        mode === 'ask' && q
          ? [...prior, { role: 'user', content: q }, { role: 'model', content: reply }]
          : [...prior, { role: 'model', content: reply }]
      setMessages(next)
      setSpeaking(true)
      speakText(reply, voiceRef.current, {
        onend: () => {
          if (id === requestIdRef.current) setSpeaking(false)
        },
      })
    } catch (err) {
      if (id !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      if (id === requestIdRef.current) setBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoadingPage(true)
    setPageError(null)
    setMessages([])
    fetchGemaraPage(daf)
      .then((data) => {
        if (cancelled) return
        const start = defaultStartIndex(daf, data.english)
        setPage(data)
        pageRef.current = data
        setLineIndex(start)
        lineRef.current = start
        void teachCurrentLine()
      })
      .catch((err: Error) => {
        if (!cancelled) setPageError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoadingPage(false)
      })
    return () => {
      cancelled = true
      requestIdRef.current += 1
      stopSpeaking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daf])

  useEffect(() => {
    feedRef.current?.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, busy])

  function goLine(nextIndex: number) {
    const current = pageRef.current
    if (!current) return
    if (nextIndex < 0 || nextIndex >= current.hebrew.length) return
    stopSpeaking()
    setSpeaking(false)
    setLineIndex(nextIndex)
    lineRef.current = nextIndex
    void teachCurrentLine()
  }

  function onAsk(e: FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    setQuestion('')
    void runFollowUp('ask', q)
  }

  return (
    <div className="shell room-shell">
      <div className="atmosphere atmosphere-soft" aria-hidden="true" />
      <header className="room-top">
        <button type="button" className="ghost-btn" onClick={onExit}>
          ← Lomed
        </button>
        <div className="room-heading">
          <p className="brand-inline">Lomed</p>
          <h1>{page?.ref || `Bava Metzia ${daf}`}</h1>
          <p className="he-ref" dir="rtl" lang="he">
            {page?.heRef || curriculum.title}
          </p>
        </div>
        <label className="voice-mini">
          <span>Voice</span>
          <select
            value={voiceId ?? voices[0]?.id ?? ''}
            onChange={(e) => onVoiceIdChange(e.target.value || null)}
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {loadingPage && <p className="status-line">Opening the Gemara…</p>}
      {pageError && <p className="error-line">{pageError}</p>}

      {page && (
        <div className="room-grid">
          <section className="gemara-panel" aria-label="Gemara text">
            <div className="panel-label">
              <span>Hebrew on the page</span>
              <span>
                Line {lineIndex + 1} / {page.hebrew.length}
              </span>
            </div>
            <div className="gemara-scroll" dir="rtl" lang="he">
              {page.hebrew.map((line, i) => {
                if (!line.trim()) return null
                const active = i === lineIndex
                return (
                  <button
                    key={i}
                    type="button"
                    className={`gemara-line${active ? ' active' : ''}`}
                    onClick={() => goLine(i)}
                  >
                    <span className="line-num">{i + 1}</span>
                    <span className="line-text">{line}</span>
                  </button>
                )
              })}
            </div>
            <div className="line-controls">
              <button
                type="button"
                className="secondary-btn"
                disabled={lineIndex <= 0 || busy}
                onClick={() => goLine(lineIndex - 1)}
              >
                Previous line
              </button>
              <button
                type="button"
                className="secondary-btn"
                disabled={lineIndex >= page.hebrew.length - 1 || busy}
                onClick={() => goLine(lineIndex + 1)}
              >
                Next line
              </button>
            </div>
          </section>

          <section className="rebbe-panel" aria-label="Rebbe">
            <div className="panel-label">
              <span>Your Rebbe · English</span>
              <span className={speaking ? 'pulse' : ''}>
                {speaking ? 'Speaking…' : busy ? 'Thinking…' : 'Ready'}
              </span>
            </div>

            <div className="rebbe-feed" ref={feedRef}>
              {messages.length === 0 && !busy && (
                <p className="empty-feed">
                  The Rebbe will start teaching this line in a moment.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role}`}
                  className={`bubble ${m.role === 'user' ? 'you' : 'rebbe'}`}
                >
                  <span className="bubble-who">
                    {m.role === 'user' ? 'You' : 'Rebbe'}
                  </span>
                  <p>{m.content}</p>
                </div>
              ))}
              {busy && <p className="status-line">Rebbe is thinking…</p>}
            </div>

            {error && <p className="error-line">{error}</p>}

            <div className="rebbe-actions">
              <button
                type="button"
                className="secondary-btn"
                disabled={busy || !messages.length}
                onClick={() => {
                  const last = [...messages]
                    .reverse()
                    .find((m) => m.role === 'model')
                  if (!last) return
                  setSpeaking(true)
                  speakText(last.content, voiceRef.current, {
                    onend: () => setSpeaking(false),
                  })
                }}
              >
                Speak again
              </button>
              <button
                type="button"
                className="secondary-btn"
                disabled={!speaking}
                onClick={() => {
                  stopSpeaking()
                  setSpeaking(false)
                }}
              >
                Stop
              </button>
              <button
                type="button"
                className="secondary-btn"
                disabled={busy}
                onClick={() => void runFollowUp('continue')}
              >
                Continue
              </button>
            </div>

            <form className="ask-form" onSubmit={onAsk}>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask the Rebbe a question…"
                disabled={busy}
              />
              <button type="submit" className="primary-btn" disabled={busy}>
                Ask
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
