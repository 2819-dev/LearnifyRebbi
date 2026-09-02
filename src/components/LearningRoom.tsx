import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import curriculum from '../data/hashavas-aveidah.json'
import { APP_NAME, REBBE_VOICES } from '../lib/brand'
import {
  askRebbe,
  playBase64Audio,
  speakAgain,
  stopSpeaking,
  type ChatMessage,
  type SpeakPayload,
} from '../lib/rebbe'
import {
  defaultStartIndex,
  fetchGemaraPage,
  type GemaraPage,
} from '../lib/sefaria'

type Props = {
  daf: string
  voiceId: string
  onExit: () => void
  onVoiceIdChange: (id: string) => void
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
  const feedRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const pageRef = useRef<GemaraPage | null>(null)
  const lineRef = useRef(0)
  const voiceRef = useRef(voiceId)
  const requestIdRef = useRef(0)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    voiceRef.current = voiceId
  }, [voiceId])

  useEffect(() => {
    pageRef.current = page
  }, [page])

  useEffect(() => {
    lineRef.current = lineIndex
  }, [lineIndex])

  useEffect(() => {
    feedRef.current?.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, busy])

  useEffect(() => () => stopSpeaking(), [])

  function playAudio(audio: SpeakPayload | null) {
    if (!audio) {
      setSpeaking(false)
      return
    }
    setSpeaking(true)
    playBase64Audio(audio, () => setSpeaking(false))
  }

  async function speakText(text: string, requestId: number) {
    try {
      const audio = await speakAgain(text, voiceRef.current)
      if (requestId !== requestIdRef.current) return
      playAudio(audio)
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      console.error(err)
      setError(
        err instanceof Error
          ? err.message
          : 'Could not speak right now.',
      )
      setSpeaking(false)
    }
  }

  async function teachCurrentLine() {
    const current = pageRef.current
    if (!current) return
    const id = ++requestIdRef.current
    const idx = lineRef.current
    setBusy(true)
    setError(null)
    setMessages([])
    stopSpeaking()
    try {
      const { reply } = await askRebbe({
        messages: [],
        gemaraRef: current.ref,
        hebrewLine: current.hebrew[idx] || '',
        englishLine: current.english[idx] || '',
        lineIndex: idx,
        mode: 'teach',
        voice: voiceRef.current,
      })
      if (id !== requestIdRef.current) return
      setMessages([{ role: 'model', content: reply }])
      setBusy(false)
      await speakText(reply, id)
    } catch (err) {
      if (id !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
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
      const { reply } = await askRebbe({
        messages: prior,
        gemaraRef: current.ref,
        hebrewLine: current.hebrew[idx] || '',
        englishLine: current.english[idx] || '',
        lineIndex: idx,
        mode,
        question: q,
        voice: voiceRef.current,
      })
      if (id !== requestIdRef.current) return
      const next: ChatMessage[] =
        mode === 'ask' && q
          ? [...prior, { role: 'user', content: q }, { role: 'model', content: reply }]
          : [...prior, { role: 'model', content: reply }]
      setMessages(next)
      setBusy(false)
      await speakText(reply, id)
    } catch (err) {
      if (id !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
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
    <div className="page room">
      <div className="wash soft" aria-hidden="true" />
      <header className="room-top">
        <button type="button" className="btn-ghost" onClick={onExit}>
          ← {APP_NAME}
        </button>
        <div className="room-title">
          <p className="wordmark-sm">{APP_NAME}</p>
          <h1>{page?.ref || `Bava Metzia ${daf}`}</h1>
          <p className="he-ref" dir="rtl" lang="he">
            {page?.heRef || curriculum.title}
          </p>
        </div>
        <label className="voice-field">
          <span>Voice</span>
          <select
            value={voiceId}
            onChange={(e) => onVoiceIdChange(e.target.value)}
          >
            {REBBE_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {loadingPage && <p className="status">Opening the Gemara…</p>}
      {pageError && <p className="error">{pageError}</p>}

      {page && (
        <div className="room-grid">
          <section className="panel gemara" aria-label="Gemara text">
            <div className="panel-bar">
              <span>On the page</span>
              <span>
                Line {lineIndex + 1} / {page.hebrew.length}
              </span>
            </div>
            <div className="gemara-scroll" dir="rtl" lang="he">
              {page.hebrew.map((line, i) => {
                if (!line.trim()) return null
                return (
                  <button
                    key={i}
                    type="button"
                    className={`gemara-line${i === lineIndex ? ' active' : ''}`}
                    onClick={() => goLine(i)}
                  >
                    <span className="line-num">{i + 1}</span>
                    <span className="line-text">{line}</span>
                  </button>
                )
              })}
            </div>
            <div className="toolbar">
              <button
                type="button"
                className="btn-secondary"
                disabled={lineIndex <= 0 || busy}
                onClick={() => goLine(lineIndex - 1)}
              >
                Previous line
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={lineIndex >= page.hebrew.length - 1 || busy}
                onClick={() => goLine(lineIndex + 1)}
              >
                Next line
              </button>
            </div>
          </section>

          <section className="panel rebbe" aria-label="Rebbe">
            <div className="panel-bar">
              <span>Rebbe · English</span>
              <span className={speaking ? 'live' : ''}>
                {speaking ? 'Speaking…' : busy ? 'Thinking…' : 'Ready'}
              </span>
            </div>

            <div className="feed" ref={feedRef}>
              {messages.length === 0 && !busy && (
                <p className="status">Class is about to start on this line.</p>
              )}
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role}`}
                  className={`note ${m.role === 'user' ? 'mine' : 'theirs'}`}
                >
                  <span className="who">
                    {m.role === 'user' ? 'You' : 'Rebbe'}
                  </span>
                  <p>{m.content}</p>
                </div>
              ))}
              {busy && <p className="status">Rebbe is thinking…</p>}
            </div>

            {error && <p className="error">{error}</p>}

            <div className="toolbar">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy || !messages.some((m) => m.role === 'model')}
                onClick={async () => {
                  const last = [...messages]
                    .reverse()
                    .find((m) => m.role === 'model')
                  if (!last) return
                  try {
                    setBusy(true)
                    setError(null)
                    const fresh = await speakAgain(
                      last.content,
                      voiceRef.current,
                    )
                    playAudio(fresh)
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : 'Could not speak right now.',
                    )
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Speak again
              </button>
              <button
                type="button"
                className="btn-secondary"
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
                className="btn-secondary"
                disabled={busy}
                onClick={() => void runFollowUp('continue')}
              >
                Continue
              </button>
            </div>

            <form className="ask" onSubmit={onAsk}>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask your Rebbe…"
                disabled={busy}
              />
              <button type="submit" className="btn-primary" disabled={busy}>
                Ask
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
