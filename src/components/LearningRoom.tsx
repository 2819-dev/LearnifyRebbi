import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { GemaraDaf } from './GemaraDaf'
import curriculum from '../data/hashavas-aveidah.json'
import { APP_NAME, REBBE_VOICES } from '../lib/brand'
import { StudentMic, micSupported } from '../lib/mic'
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
  notesForLine,
  type GemaraPage,
} from '../lib/sefaria'

type Props = {
  daf: string
  voiceId: string
  onExit: () => void
  onVoiceIdChange: (id: string) => void
}

function lineCommentText(page: GemaraPage, lineIndex: number, kind: 'rashi' | 'tosafot') {
  const notes = notesForLine(
    kind === 'rashi' ? page.rashi : page.tosafot,
    lineIndex,
  )
  return notes.map((n) => n.he || n.en).filter(Boolean).join('\n')
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
  const [micMuted, setMicMuted] = useState(false)
  const [micListening, setMicListening] = useState(false)
  const [micPartial, setMicPartial] = useState('')
  const [micAvailable] = useState(() => micSupported())
  const feedRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const pageRef = useRef<GemaraPage | null>(null)
  const lineRef = useRef(0)
  const voiceRef = useRef(voiceId)
  const requestIdRef = useRef(0)
  const busyRef = useRef(false)
  const speakingRef = useRef(false)
  const micRef = useRef<StudentMic | null>(null)
  const micMutedRef = useRef(false)

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
    busyRef.current = busy
  }, [busy])

  useEffect(() => {
    speakingRef.current = speaking
  }, [speaking])

  useEffect(() => {
    micMutedRef.current = micMuted
  }, [micMuted])

  useEffect(() => {
    feedRef.current?.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, busy])

  useEffect(() => () => {
    stopSpeaking()
    micRef.current?.stop()
  }, [])

  function playAudio(audio: SpeakPayload | null) {
    if (!audio) {
      setSpeaking(false)
      micRef.current?.resume()
      return
    }
    setSpeaking(true)
    micRef.current?.pause()
    playBase64Audio(audio, () => {
      setSpeaking(false)
      if (!micMutedRef.current) micRef.current?.resume()
    })
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
        err instanceof Error ? err.message : 'Could not speak right now.',
      )
      setSpeaking(false)
      if (!micMutedRef.current) micRef.current?.resume()
    }
  }

  function currentContext() {
    const current = pageRef.current
    const idx = lineRef.current
    if (!current) return null
    return {
      current,
      idx,
      rashiForLine: lineCommentText(current, idx, 'rashi'),
      tosafotForLine: lineCommentText(current, idx, 'tosafot'),
    }
  }

  async function teachCurrentLine() {
    const ctx = currentContext()
    if (!ctx) return
    const id = ++requestIdRef.current
    setBusy(true)
    setError(null)
    setMessages([])
    stopSpeaking()
    try {
      const { reply } = await askRebbe({
        messages: [],
        gemaraRef: ctx.current.ref,
        hebrewLine: ctx.current.hebrew[ctx.idx] || '',
        englishLine: ctx.current.english[ctx.idx] || '',
        lineIndex: ctx.idx,
        mode: 'teach',
        voice: voiceRef.current,
        rashiForLine: ctx.rashiForLine,
        tosafotForLine: ctx.tosafotForLine,
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
    const ctx = currentContext()
    if (!ctx || busyRef.current) return
    const id = ++requestIdRef.current
    setBusy(true)
    setError(null)
    stopSpeaking()
    setSpeaking(false)
    try {
      const prior = messagesRef.current
      const { reply } = await askRebbe({
        messages: prior,
        gemaraRef: ctx.current.ref,
        hebrewLine: ctx.current.hebrew[ctx.idx] || '',
        englishLine: ctx.current.english[ctx.idx] || '',
        lineIndex: ctx.idx,
        mode,
        question: q,
        voice: voiceRef.current,
        rashiForLine: ctx.rashiForLine,
        tosafotForLine: ctx.tosafotForLine,
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

  function handleSpokenQuestion(raw: string) {
    let text = raw.trim()
    if (!text) return
    // Kids often start with "Rebbe..."
    text = text.replace(/^(hey\s+)?rebbe[,:]?\s+/i, '').trim()
    if (text.length < 2) return
    if (busyRef.current) return
    setMicPartial('')
    void runFollowUp('ask', text)
  }

  function startMic() {
    if (!micAvailable || micMutedRef.current) return
    if (!micRef.current) micRef.current = new StudentMic()
    micRef.current.start({
      onFinal: handleSpokenQuestion,
      onPartial: (t) => setMicPartial(t),
      onError: (message) => setError(message),
    })
    setMicListening(true)
  }

  function stopMic() {
    micRef.current?.stop()
    setMicListening(false)
    setMicPartial('')
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
        if (!micMutedRef.current) startMic()
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
      stopMic()
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

  function toggleMute() {
    const next = !micMuted
    setMicMuted(next)
    micMutedRef.current = next
    if (next) stopMic()
    else startMic()
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
        <div className="room-controls">
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
          <button
            type="button"
            className={`btn-mic${micMuted ? ' muted' : ''}${micListening && !micMuted ? ' on' : ''}`}
            onClick={toggleMute}
            title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {micMuted ? 'Mic muted' : micListening ? 'Listening…' : 'Mic'}
          </button>
        </div>
      </header>

      {loadingPage && <p className="status">Opening the Gemara…</p>}
      {pageError && <p className="error">{pageError}</p>}

      {page && (
        <div className="room-grid daf-grid">
          <section className="panel daf-wrap" aria-label="Gemara page">
            <GemaraDaf
              page={page}
              lineIndex={lineIndex}
              onSelectLine={goLine}
            />
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
                {speaking
                  ? 'Speaking…'
                  : busy
                    ? 'Thinking…'
                    : micMuted
                      ? 'Ready · mic muted'
                      : micListening
                        ? 'Ready · listening'
                        : 'Ready'}
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
              {!micMuted && micPartial && (
                <p className="mic-partial">Hearing: “{micPartial}”</p>
              )}
            </div>

            {error && <p className="error">{error}</p>}
            {!micAvailable && (
              <p className="status mic-note">
                This browser cannot use the microphone. You can still type.
              </p>
            )}

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
                  if (!micMutedRef.current) micRef.current?.resume()
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
                placeholder={
                  micMuted
                    ? 'Mic muted — type a question…'
                    : 'Say “Rebbe…” or type a question…'
                }
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
