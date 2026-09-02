import { useEffect, useRef, useState } from 'react'
import { GemaraDaf } from './GemaraDaf'
import { APP_NAME, REBBE_VOICES } from '../lib/brand'
import { StudentMic, looksHebrew, micSupported } from '../lib/mic'
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

function lineCommentText(
  page: GemaraPage,
  lineIndex: number,
  kind: 'rashi' | 'tosafot',
) {
  const notes = notesForLine(
    kind === 'rashi' ? page.rashi : page.tosafot,
    lineIndex,
  )
  return notes.map((n) => n.he || n.en).filter(Boolean).join('\n')
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || '')
  if (/429|quota|rate|Resource exhausted|limit/i.test(msg)) {
    return 'The Rebbe needs a short rest (free Gemini limit). Wait about a minute, then tap Continue or speak again.'
  }
  if (/high demand|503|unavailable/i.test(msg)) {
    return 'The Rebbe is busy right now. Wait a moment and try again.'
  }
  return msg || 'Something went wrong.'
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
  const [speaking, setSpeaking] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const [micListening, setMicListening] = useState(false)
  const [micPartial, setMicPartial] = useState('')
  const [showType, setShowType] = useState(false)
  const [typed, setTyped] = useState('')
  const [micAvailable] = useState(() => micSupported())
  const feedRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const pageRef = useRef<GemaraPage | null>(null)
  const lineRef = useRef(0)
  const voiceRef = useRef(voiceId)
  const requestIdRef = useRef(0)
  const busyRef = useRef(false)
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
    micMutedRef.current = micMuted
  }, [micMuted])

  useEffect(() => {
    feedRef.current?.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, busy, speaking])

  useEffect(
    () => () => {
      stopSpeaking()
      micRef.current?.stop()
    },
    [],
  )

  function playAudio(audio: SpeakPayload | null) {
    if (!audio) {
      setSpeaking(false)
      if (!micMutedRef.current) micRef.current?.resume()
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
      setError(friendlyError(err))
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
      setError(friendlyError(err))
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
          ? [
              ...prior,
              { role: 'user', content: q },
              { role: 'model', content: reply },
            ]
          : [...prior, { role: 'model', content: reply }]
      setMessages(next)
      setBusy(false)
      await speakText(reply, id)
    } catch (err) {
      if (id !== requestIdRef.current) return
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  function handleSpokenQuestion(raw: string) {
    let text = raw.trim()
    if (!text) return
    text = text.replace(/^(hey\s+)?rebbe[,:]?\s+/i, '').trim()
    text = text.replace(/^רבי[,:]?\s+/u, '').trim()
    if (text.length < 2) return
    if (busyRef.current) return
    if (looksHebrew(text)) micRef.current?.setLang('he-IL')
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

  function toggleMute() {
    const next = !micMuted
    setMicMuted(next)
    micMutedRef.current = next
    if (next) stopMic()
    else startMic()
  }

  const lastRebbe = [...messages].reverse().find((m) => m.role === 'model')

  return (
    <div className="shell room">
      <header className="room-bar">
        <button type="button" className="linkish" onClick={onExit}>
          {APP_NAME}
        </button>
        <div className="room-meta">
          <h1>{page?.ref || `Bava Metzia ${daf}`}</h1>
          <p dir="rtl" lang="he">
            {page?.heRef}
          </p>
        </div>
        <label className="voice-pick">
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

      {loadingPage && <p className="soft">Opening the Gemara…</p>}
      {pageError && <p className="bad">{pageError}</p>}

      {page && (
        <div className="learn">
          <section className="daf-pane">
            <GemaraDaf
              page={page}
              lineIndex={lineIndex}
              onSelectLine={goLine}
            />
            <div className="pager">
              <button
                type="button"
                disabled={lineIndex <= 0 || busy}
                onClick={() => goLine(lineIndex - 1)}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={lineIndex >= page.hebrew.length - 1 || busy}
                onClick={() => goLine(lineIndex + 1)}
              >
                Next
              </button>
            </div>
          </section>

          <section className="talk-pane">
            <div className="talk-status">
              <span>
                {speaking
                  ? 'Rebbe speaking'
                  : busy
                    ? 'Thinking'
                    : micMuted
                      ? 'Mic muted'
                      : micListening
                        ? 'Listening to you'
                        : 'Ready'}
              </span>
            </div>

            <div className="talk-feed" ref={feedRef}>
              {lastRebbe ? (
                <p className="rebbe-said">{lastRebbe.content}</p>
              ) : (
                <p className="soft">Your Rebbe will speak in a moment.</p>
              )}
              {messages
                .filter((m) => m.role === 'user')
                .slice(-2)
                .map((m, i) => (
                  <p key={i} className="you-said">
                    You: {m.content}
                  </p>
                ))}
              {!micMuted && micPartial && (
                <p className="hearing">Hearing: {micPartial}</p>
              )}
            </div>

            {error && <p className="bad">{error}</p>}

            <div className="voice-dock">
              <button
                type="button"
                className={`mic-btn${micMuted ? ' off' : ''}${micListening && !micMuted ? ' live' : ''}`}
                onClick={toggleMute}
              >
                {micMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runFollowUp('continue')}
              >
                Continue
              </button>
              <button
                type="button"
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
                disabled={busy || !lastRebbe}
                onClick={async () => {
                  if (!lastRebbe) return
                  try {
                    setBusy(true)
                    setError(null)
                    const audio = await speakAgain(
                      lastRebbe.content,
                      voiceRef.current,
                    )
                    playAudio(audio)
                  } catch (err) {
                    setError(friendlyError(err))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Again
              </button>
            </div>

            <p className="hint">
              {micAvailable
                ? 'Speak to the Rebbe. Hebrew words are fine. Mute if you need quiet.'
                : 'This browser cannot listen. Use Chrome for voice.'}
            </p>

            <button
              type="button"
              className="linkish tiny"
              onClick={() => setShowType((v) => !v)}
            >
              {showType ? 'Hide typing' : 'Need to type?'}
            </button>

            {showType && (
              <form
                className="type-fallback"
                onSubmit={(e) => {
                  e.preventDefault()
                  const q = typed.trim()
                  if (!q) return
                  setTyped('')
                  void runFollowUp('ask', q)
                }}
              >
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Only if you must type…"
                  disabled={busy}
                />
                <button type="submit" disabled={busy}>
                  Send
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
