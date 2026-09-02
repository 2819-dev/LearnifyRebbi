import { useEffect, useRef, useState } from 'react'
import { GemaraDaf } from './GemaraDaf'
import { APP_NAME, REBBE_VOICES } from '../lib/brand'
import { HIGHLIGHT_TERM_HINTS } from '../lib/curriculum'
import {
  chunkPhrase,
  fallbackHighlights,
  realWordIndexes,
  runReadingWalk,
  splitHebrewWords,
  type ActiveHighlights,
} from '../lib/highlights'
import { StudentMic, looksHebrew, micSupported } from '../lib/mic'
import {
  askRebbe,
  playBase64Audio,
  playBrowserSpeech,
  speakAgain,
  stopSpeaking,
  unlockAudio,
  type ChatMessage,
  type RebbeResponse,
  type SpeakPayload,
  type TextHighlight,
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
  onShowTour?: () => void
}

type DrillPhase = 'idle' | 'listening-repeat'

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
    return 'Tap Replay to hear the Rebbe.'
  }
  return 'Something went wrong. Please try again.'
}

function normalizeSpeech(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\u0590-\u05FFa-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function roughlyMatches(heard: string, target: string): boolean {
  const a = normalizeSpeech(heard)
  const b = normalizeSpeech(target)
  if (!a || !b) return a.length >= 2
  if (a.includes(b) || b.includes(a)) return true
  const aw = a.split(' ')
  const bw = b.split(' ')
  const hits = bw.filter((w) => w.length > 1 && aw.some((x) => x.includes(w) || w.includes(x)))
  return hits.length >= Math.max(1, Math.ceil(bw.length / 2))
}

export function LearningRoom({
  daf,
  voiceId,
  onExit,
  onVoiceIdChange,
  onShowTour,
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
  const [phase, setPhase] = useState<DrillPhase>('idle')
  const [highlights, setHighlights] = useState<ActiveHighlights | null>(null)
  const [micAvailable] = useState(() => micSupported())
  const messagesRef = useRef<ChatMessage[]>([])
  const pageRef = useRef<GemaraPage | null>(null)
  const lineRef = useRef(0)
  const voiceRef = useRef(voiceId)
  const requestIdRef = useRef(0)
  const busyRef = useRef(false)
  const micRef = useRef<StudentMic | null>(null)
  const micMutedRef = useRef(false)
  const welcomedRef = useRef(false)
  const pendingExplainRef = useRef('')
  const pendingExplainPromiseRef = useRef<Promise<string> | null>(null)
  const repeatTargetRef = useRef('')
  const phraseOffsetRef = useRef(0)
  const phaseRef = useRef<DrillPhase>('idle')
  const lastLessonRef = useRef<RebbeResponse | null>(null)
  const walkStopRef = useRef<(() => void) | null>(null)
  const marksRef = useRef<TextHighlight[]>([])

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
    phaseRef.current = phase
  }, [phase])

  function clearWalk() {
    walkStopRef.current?.()
    walkStopRef.current = null
  }

  useEffect(
    () => () => {
      stopSpeaking()
      clearWalk()
      micRef.current?.stop()
    },
    [],
  )

  function applyMarks(marks: TextHighlight[], preferHebrew = '') {
    const line = pageRef.current?.hebrew[lineRef.current] || ''
    const seed = preferHebrew
      ? [{ word: preferHebrew.split(/\s+/)[0] || preferHebrew, kind: 'term' as const }]
      : []
    const merged =
      marks.length > 0
        ? marks
        : [...seed, ...fallbackHighlights(line, HIGHLIGHT_TERM_HINTS)].slice(0, 4)
    marksRef.current = merged
    setHighlights({ readingIndex: null, marks: merged })
  }

  function startReadingWalk(durationMs: number) {
    clearWalk()
    const line = pageRef.current?.hebrew[lineRef.current] || ''
    const parts = splitHebrewWords(line)
    const real = realWordIndexes(parts)
    walkStopRef.current = runReadingWalk(real.length, durationMs, (idx) => {
      setHighlights({
        readingIndex: idx,
        marks: marksRef.current,
      })
    })
  }

  async function playAudio(audio: SpeakPayload | null) {
    if (!audio) {
      setSpeaking(false)
      clearWalk()
      if (!micMutedRef.current) micRef.current?.resume()
      return
    }
    setSpeaking(true)
    micRef.current?.pause()
    try {
      await playBase64Audio(audio, {
        onDuration: (ms) => startReadingWalk(ms),
        onend: () => {
          setSpeaking(false)
          setNeedsGesture(false)
          clearWalk()
          setHighlights((prev) =>
            prev ? { ...prev, readingIndex: null } : prev,
          )
          if (!micMutedRef.current) micRef.current?.resume()
        },
      })
      setNeedsGesture(false)
    } catch (err) {
      setSpeaking(false)
      clearWalk()
      setNeedsGesture(true)
      setError(friendlyError(err))
      if (!micMutedRef.current) micRef.current?.resume()
      throw err
    }
  }

  async function speakUtterance(
    text: string,
    opts?: { hebrew?: boolean; audio?: SpeakPayload | null },
  ) {
    if (!text.trim()) return
    setSpeaking(true)
    micRef.current?.pause()
    try {
      if (opts?.hebrew) {
        await playBrowserSpeech(text, {
          lang: 'he-IL',
          rate: 0.76,
          pitch: 0.9,
          onDuration: (ms) => startReadingWalk(ms),
        })
      } else if (opts?.audio) {
        await playAudio(opts.audio)
        return
      } else {
        // Local male voice first — reliable sound and much faster than TTS.
        await playBrowserSpeech(text, {
          lang: 'en-US',
          rate: 0.9,
          pitch: 0.85,
          onDuration: (ms) => startReadingWalk(ms),
        })
      }
      setSpeaking(false)
      clearWalk()
      setNeedsGesture(false)
      if (!micMutedRef.current) micRef.current?.resume()
    } catch (err) {
      // Last resort: try Gemini / server speech once.
      try {
        const audio = await speakAgain(text, voiceRef.current)
        await playAudio(audio)
        return
      } catch (inner) {
        setSpeaking(false)
        clearWalk()
        setNeedsGesture(true)
        setError(friendlyError(inner))
        if (!micMutedRef.current) micRef.current?.resume()
        throw inner
      }
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

  async function finishExplain(requestId: number) {
    setPhase('idle')
    if (requestId !== requestIdRef.current) return
    let explain = pendingExplainRef.current
    if (pendingExplainPromiseRef.current) {
      try {
        const fromApi = await pendingExplainPromiseRef.current
        if (fromApi) explain = fromApi
      } catch {
        // keep local fallback
      }
    }
    pendingExplainPromiseRef.current = null
    if (!explain) return
    if (requestId !== requestIdRef.current) return
    pendingExplainRef.current = explain
    await speakUtterance(explain)
  }

  async function runDrill(lesson: RebbeResponse, requestId: number) {
    lastLessonRef.current = lesson
    applyMarks(lesson.highlights, lesson.hebrew)

    if (lesson.welcome && !welcomedRef.current) {
      welcomedRef.current = true
      await speakUtterance(lesson.welcome)
      if (requestId !== requestIdRef.current) return
    }

    if (lesson.hebrew) {
      await speakUtterance(lesson.hebrew, { hebrew: true })
      if (requestId !== requestIdRef.current) return
    }

    if (lesson.english) {
      await speakUtterance(`That means: ${lesson.english}`)
      if (requestId !== requestIdRef.current) return
    }

    pendingExplainRef.current = lesson.explain || lesson.reply || ''
    repeatTargetRef.current = lesson.hebrew || lesson.english || ''

    if (repeatTargetRef.current) {
      await speakUtterance('Now you say it.')
      if (requestId !== requestIdRef.current) return
      setPhase('listening-repeat')
      micRef.current?.setLang(
        looksHebrew(repeatTargetRef.current) ? 'he-IL' : 'en-US',
      )
      if (!micMutedRef.current) micRef.current?.resume()
      return
    }

    await finishExplain(requestId)
  }

  function startExplainFetch(
    mode: 'teach' | 'continue',
    ctx: NonNullable<ReturnType<typeof currentContext>>,
    localExplain: string,
    hebrewChunk: string,
  ) {
    pendingExplainRef.current = localExplain
    const promise = askRebbe({
      messages: messagesRef.current,
      gemaraRef: ctx.current.ref,
      hebrewLine: ctx.current.hebrew[ctx.idx] || '',
      englishLine: ctx.current.english[ctx.idx] || '',
      lineIndex: ctx.idx,
      mode,
      voice: voiceRef.current,
      rashiForLine: ctx.rashiForLine,
      tosafotForLine: ctx.tosafotForLine,
      needWelcome: false,
      includeSpeech: false,
      question: undefined,
    })
      .then((lesson) => {
        if (lesson.highlights?.length) applyMarks(lesson.highlights, hebrewChunk)
        const explain = lesson.explain || lesson.reply || localExplain
        pendingExplainRef.current = explain
        const summary = [hebrewChunk, lesson.english, explain]
          .filter(Boolean)
          .join(' — ')
        setMessages((prev) =>
          prev.length
            ? [...prev, { role: 'model', content: summary }]
            : [{ role: 'model', content: summary }],
        )
        return explain
      })
      .catch(() => localExplain)
    pendingExplainPromiseRef.current = promise
  }

  async function teachCurrentLine() {
    const ctx = currentContext()
    if (!ctx) return
    const id = ++requestIdRef.current
    setBusy(true)
    setError(null)
    setPhase('idle')
    setMessages([])
    stopSpeaking()
    clearWalk()
    phraseOffsetRef.current = 0

    const hebrewLine = ctx.current.hebrew[ctx.idx] || ''
    const englishLine = ctx.current.english[ctx.idx] || ''
    const chunk = chunkPhrase(hebrewLine, englishLine, 0)
    phraseOffsetRef.current = chunk.nextOffset

    const welcome = !welcomedRef.current
      ? 'Welcome. We will learn this line together, a few words at a time.'
      : ''

    const instant: RebbeResponse = {
      reply: chunk.explain,
      welcome,
      hebrew: chunk.hebrew,
      english: chunk.english,
      explain: chunk.explain,
      highlights: fallbackHighlights(chunk.hebrew, HIGHLIGHT_TERM_HINTS),
    }

    // Fetch richer explanation in the background while we already speak.
    startExplainFetch('teach', ctx, chunk.explain, chunk.hebrew)

    setBusy(false)
    try {
      await runDrill(instant, id)
    } catch (err) {
      if (id !== requestIdRef.current) return
      setError(friendlyError(err))
      setNeedsGesture(true)
    }
  }

  async function runFollowUp(mode: 'continue' | 'ask', q?: string) {
    const ctx = currentContext()
    if (!ctx || busyRef.current) return
    const id = ++requestIdRef.current
    setBusy(true)
    setError(null)
    setPhase('idle')
    stopSpeaking()
    clearWalk()
    setSpeaking(false)

    try {
      if (mode === 'ask') {
        const prior = messagesRef.current
        const lesson = await askRebbe({
          messages: prior,
          gemaraRef: ctx.current.ref,
          hebrewLine: ctx.current.hebrew[ctx.idx] || '',
          englishLine: ctx.current.english[ctx.idx] || '',
          lineIndex: ctx.idx,
          mode: 'ask',
          question: q,
          voice: voiceRef.current,
          rashiForLine: ctx.rashiForLine,
          tosafotForLine: ctx.tosafotForLine,
          needWelcome: false,
          includeSpeech: false,
        })
        if (id !== requestIdRef.current) return
        applyMarks(lesson.highlights)
        const spoken = lesson.reply || lesson.explain || 'Good question.'
        setMessages([
          ...prior,
          ...(q ? [{ role: 'user' as const, content: q }] : []),
          { role: 'model', content: spoken },
        ])
        setBusy(false)
        await speakUtterance(spoken)
        return
      }

      // Continue: next ~3-word chunk immediately; explain loads in parallel.
      const hebrewLine = ctx.current.hebrew[ctx.idx] || ''
      const englishLine = ctx.current.english[ctx.idx] || ''
      let offset = phraseOffsetRef.current
      let chunk = chunkPhrase(hebrewLine, englishLine, offset)
      if (chunk.done && !chunk.hebrew) {
        offset = 0
        chunk = chunkPhrase(hebrewLine, englishLine, 0)
      }
      phraseOffsetRef.current = chunk.nextOffset

      const instant: RebbeResponse = {
        reply: chunk.explain,
        welcome: '',
        hebrew: chunk.hebrew,
        english: chunk.english,
        explain: chunk.explain,
        highlights: fallbackHighlights(chunk.hebrew, HIGHLIGHT_TERM_HINTS),
      }
      startExplainFetch('continue', ctx, chunk.explain, chunk.hebrew)
      setBusy(false)
      await runDrill(instant, id)
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

    if (phaseRef.current === 'listening-repeat') {
      if (roughlyMatches(text, repeatTargetRef.current) || text.length > 1) {
        const id = requestIdRef.current
        void finishExplain(id)
      }
      return
    }

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
    setHighlights(null)
    setPhase('idle')
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
      clearWalk()
      stopMic()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daf])

  function goLine(nextIndex: number) {
    const current = pageRef.current
    if (!current) return
    if (nextIndex < 0 || nextIndex >= current.hebrew.length) return
    stopSpeaking()
    clearWalk()
    setSpeaking(false)
    setPhase('idle')
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
      const lesson = lastLessonRef.current
      if (lesson?.hebrew || lesson?.english) {
        setBusy(true)
        await runDrill(lesson, requestIdRef.current)
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
      : phase === 'listening-repeat'
        ? 'Your turn — say it'
        : needsGesture
          ? 'Tap Replay to hear'
          : micMuted
            ? 'Muted'
            : micListening
              ? 'Listening'
              : 'Ready'

  return (
    <div className="shell room">
      <header className="room-bar">
        <div className="room-brand">
          <button type="button" className="linkish" onClick={onExit}>
            {APP_NAME}
          </button>
          {onShowTour && (
            <button type="button" className="linkish tiny" onClick={onShowTour}>
              How it works
            </button>
          )}
        </div>
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
      {pageError && (
        <p className="bad">Could not open this page. Please try again.</p>
      )}

      {page && (
        <div className="learn voice-only">
          <section className="daf-pane">
            <GemaraDaf
              page={page}
              lineIndex={lineIndex}
              onSelectLine={goLine}
              highlights={highlights}
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
              className={`speaker-orb${speaking ? ' on' : ''}${busy && !speaking ? ' wait' : ''}${phase === 'listening-repeat' ? ' wait' : ''}`}
              aria-hidden
            >
              <span />
            </div>
            <p className="speaker-status">{status}</p>
            {error && <p className="bad">{error}</p>}

            <div className="voice-dock">
              <button
                type="button"
                className={`btn-main hear-btn${needsGesture ? ' pulse' : ''}`}
                onClick={() => void hearAgainFromTap()}
                disabled={busy && !needsGesture}
              >
                Replay
              </button>
              {phase === 'listening-repeat' && (
                <button
                  type="button"
                  className="btn-main"
                  onClick={() => void finishExplain(requestIdRef.current)}
                >
                  I said it
                </button>
              )}
              <button
                type="button"
                className={`mic-btn${micMuted ? ' off' : ''}${micListening && !micMuted ? ' live' : ''}`}
                onClick={toggleMute}
              >
                {micMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button"
                disabled={busy || phase === 'listening-repeat'}
                onClick={() => void runFollowUp('continue')}
              >
                Continue
              </button>
              <button
                type="button"
                disabled={!speaking}
                onClick={() => {
                  stopSpeaking()
                  clearWalk()
                  setSpeaking(false)
                  setHighlights((prev) =>
                    prev ? { ...prev, readingIndex: null } : prev,
                  )
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
