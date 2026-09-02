import { useEffect, useRef, useState } from 'react'
import { GemaraDaf } from './GemaraDaf'
import { APP_NAME, REBBE_VOICES } from '../lib/brand'
import { StudentMic, looksHebrew, micSupported } from '../lib/mic'
import {
  askRebbe,
  playBase64Audio,
  speakAgain,
  stopSpeaking,
  unlockAudio,
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
    return 'Please wait a moment, then continue.'
  }
  if (/high demand|503|unavailable/i.test(msg)) {
    return 'Please try again in a moment.'
  }
  if (/play|sound|Audio|NotAllowedError/i.test(msg)) {
    return 'Tap Replay to continue.'
  }
  return 'Something went wrong. Please try again.'
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
  const [needsGesture, setNeedsGesture] = useState(false)
  const [micAvailable] = useState(() => micSupported())
  const messagesRef = useRef<ChatMessage[]>([])
  const pageRef = useRef<GemaraPage | null>(null)
  const lineRef = useRef(0)
  const voiceRef = useRef(voiceId)
  const requestIdRef = useRef(0)
  const busyRef = useRef(false)
  const micRef = useRef<StudentMic | null>(null)
  const micMutedRef = useRef(false)
  const lastReplyRef = useRef('')

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

  useEffect(
    () => () => {
      stopSpeaking()
      micRef.current?.stop()
    },
    [],
  )

  async function playAudio(audio: SpeakPayload | null) {
    if (!audio) {
      setSpeaking(false)
      if (!micMutedRef.current) micRef.current?.resume()
      return
    }
    setSpeaking(true)
    micRef.current?.pause()
    try {
      await playBase64Audio(audio, () => {
        setSpeaking(false)
        setNeedsGesture(false)
        if (!micMutedRef.current) micRef.current?.resume()
      })
      setNeedsGesture(false)
    } catch (err) {
      setSpeaking(false)
      setNeedsGesture(true)
      setError(friendlyError(err))
      if (!micMutedRef.current) micRef.current?.resume()
    }
  }

  async function speakText(text: string, requestId: number) {
    lastReplyRef.current = text
    try {
      const audio = await speakAgain(text, voiceRef.current)
      if (requestId !== requestIdRef.current) return
      await playAudio(audio)
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setNeedsGesture(true)
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
      setNeedsGesture(true)
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
      setNeedsGesture(true)
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
    void runFollowUp('ask', text)
  }

  function startMic() {
    if (!micAvailable || micMutedRef.current) return
    if (!micRef.current) micRef.current = new StudentMic()
    micRef.current.start({
      onFinal: handleSpokenQuestion,
      onError: (message) => setError(message),
    })
    setMicListening(true)
  }

  function stopMic() {
    micRef.current?.stop()
    setMicListening(false)
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

  async function hearAgainFromTap() {
    setError(null)
    try {
      await unlockAudio()
      setNeedsGesture(false)
      const text = lastReplyRef.current
      if (text) {
        setBusy(true)
        const audio = await speakAgain(text, voiceRef.current)
        await playAudio(audio)
        setBusy(false)
        return
      }
      await teachCurrentLine()
    } catch (err) {
      setBusy(false)
      setNeedsGesture(true)
      setError(friendlyError(err))
    }
  }

  const status = speaking
    ? 'Speaking'
    : busy
      ? 'Preparing'
      : needsGesture
        ? 'Ready when you are'
        : micMuted
          ? 'Muted'
          : micListening
            ? 'Listening'
            : 'Ready'

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

      {loadingPage && <p className="soft">Opening…</p>}
      {pageError && <p className="bad">Could not open this page. Please try again.</p>}

      {page && (
        <div className="learn voice-only">
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
                Previous
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

          <section className="talk-pane talk-voice">
            <div
              className={`speaker-orb${speaking ? ' on' : ''}${busy && !speaking ? ' wait' : ''}`}
              aria-hidden
            >
              <span />
            </div>
            <p className="speaker-status">{status}</p>
            {error && <p className="bad">{error}</p>}

            <div className="voice-dock">
              <button
                type="button"
                className="btn-main hear-btn"
                onClick={() => void hearAgainFromTap()}
                disabled={busy && !needsGesture}
              >
                Replay
              </button>
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
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
