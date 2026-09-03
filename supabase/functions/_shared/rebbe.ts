import { curriculum } from './curriculum.ts'
import { setting } from './db.ts'
import { httpError } from './http.ts'
import { trainingHintsForPrompt } from './hints.ts'

export const SYSTEM_PROMPT = "You are a warm, professional male Rebbe tutoring ONE Jewish child (about 9\u201314) in Guide.\n\nNever speak to a class. Never say everyone or sit down.\n\nVOICE:\n- Calm adult man. Clear. Kind. Not theatrical.\n- English is the main language.\n- Pronounce Hebrew carefully and correctly when you say Hebrew words.\n\nTEACH / CONTINUE PEDAGOGY (important):\n1) Pick a short chunk from the Gemara line \u2014 about 2 to 4 words (not one isolated word unless it is a key term alone).\n2) The student will hear: Hebrew chunk \u2192 English meaning \u2192 then they repeat.\n3) After they repeat, you give a tiny explanation (1\u20132 sentences).\n\nASK MODE:\n- Answer briefly and clearly.\n\nSTRICT ACCURACY:\n- Use ONLY the Gemara line, Rashi/Tosafot provided, and curriculum notes.\n- No invented meforshim. No practical real-life psak.\n\nOUTPUT \u2014 ONLY valid JSON:\n{\n  \"welcome\": \"empty string usually; one short welcome only if asked\",\n  \"hebrew\": \"2\u20134 Hebrew words from the line\",\n  \"english\": \"plain English meaning of that chunk\",\n  \"explain\": \"1\u20132 spoken sentences after the student repeats\",\n  \"speech\": \"for ask/continue free talk: what you say out loud; otherwise empty\",\n  \"highlights\": [\n    { \"word\": \"Hebrew word from the line\", \"kind\": \"term|rashi|focus|reading\" }\n  ]\n}\nKeep every spoken field short. Prefer 1\u20133 highlights."

export const REBBE_VOICES = [
  { id: 'Charon', label: 'Teacher', blurb: 'Warm professional man.' },
  { id: 'Sadaltager', label: 'Steady', blurb: 'Clear and knowledgeable.' },
  { id: 'Schedar', label: 'Even', blurb: 'Calm and measured.' },
  { id: 'Gacrux', label: 'Warm', blurb: 'Gentle pacing.' },
]

type ChatMessage = { role?: string; content?: string }

export type LessonPayload = {
  welcome: string
  hebrew: string
  english: string
  explain: string
  speech: string
  highlights: { word: string; kind: string }[]
}

function clip(text: unknown, max = 420): string {
  const s = String(text || '').trim()
  if (s.length <= max) return s
  return (s.slice(0, max)) + "\u2026"
}

export function buildCurriculumBlock(): string {
  return [
    "Topic: " + (curriculum.title),
    "Overview: " + (curriculum.overview),
    'Key ideas:',
    ...curriculum.concepts
      .slice(0, 4)
      .map((x) => "- " + (x.term) + ": " + (x.kidExplanation)),
  ].join('\n')
}

async function geminiKey(): Promise<string> {
  return Deno.env.get('GEMINI_API_KEY') || (await setting('gemini_api_key')) || ''
}

async function geminiModel(): Promise<string> {
  return (
    Deno.env.get('GEMINI_MODEL') ||
    (await setting('gemini_model')) ||
    'gemini-3.1-flash-lite'
  )
}

async function ttsModel(): Promise<string> {
  return (
    Deno.env.get('GEMINI_TTS_MODEL') ||
    (await setting('gemini_tts_model')) ||
    'gemini-2.5-flash-preview-tts'
  )
}

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < tries; i += 1) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const status = Number((err as { status?: number })?.status)
      const msg = String((err as { message?: string })?.message || '')
      const retryable =
        status === 429 ||
        status === 503 ||
        /high demand|quota|rate|unavailable|Resource exhausted/i.test(msg)
      if (!retryable || i === tries - 1) throw err
      await new Promise((r) => setTimeout(r, 600 * (i + 1) * (i + 1)))
    }
  }
  throw lastErr
}

function chunkHebrewFallback(hebrewLine = '', englishLine = '') {
  const words = String(hebrewLine).trim().split(/\s+/).filter(Boolean)
  const hebrew = words.slice(0, Math.min(3, Math.max(2, words.length))).join(' ')
  const english = clip(englishLine, 120) || 'Look carefully at these words.'
  return {
    hebrew,
    english,
    explain: hebrew
      ? 'Good. Keep those words in mind as we learn this line.'
      : 'Let us look at this line together.',
  }
}

function parseLessonPayload(
  raw: string,
  hebrewLine = '',
  englishLine = '',
): LessonPayload {
  const text = String(raw || '').trim()
  const fallback = chunkHebrewFallback(hebrewLine, englishLine)
  try {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1))
      const highlights = Array.isArray(parsed.highlights)
        ? parsed.highlights
            .map((h: { word?: string; kind?: string }) => ({
              word: String(h.word || '').trim(),
              kind: ['reading', 'term', 'rashi', 'focus'].includes(String(h.kind))
                ? String(h.kind)
                : 'term',
            }))
            .filter((h: { word: string }) => h.word)
            .slice(0, 6)
        : []

      const hebrew = clip(parsed.hebrew || fallback.hebrew, 120)
      const english = clip(parsed.english || fallback.english, 160)
      const explain = clip(parsed.explain || fallback.explain, 280)
      const welcome = clip(parsed.welcome || '', 160)
      const speech = clip(
        parsed.speech ||
          [hebrew && "Hebrew: " + (hebrew), english && "That means: " + (english), explain]
            .filter(Boolean)
            .join(' '),
        700,
      )
      return { welcome, hebrew, english, explain, speech, highlights }
    }
  } catch {
    // fall through
  }
  return {
    welcome: '',
    hebrew: fallback.hebrew,
    english: fallback.english,
    explain: fallback.explain,
    speech: clip(text || fallback.explain, 700),
    highlights: [],
  }
}

export async function generateRebbeReply(
  body: Record<string, unknown>,
): Promise<LessonPayload> {
  const apiKey = await geminiKey()
  if (!apiKey) throw httpError('Missing GEMINI_API_KEY', 500)

  const messages = Array.isArray(body.messages)
    ? (body.messages as ChatMessage[])
    : []
  const gemaraRef = String(body.gemaraRef || '')
  const hebrewLine = String(body.hebrewLine || '')
  const englishLine = String(body.englishLine || '')
  const lineIndex = Number(body.lineIndex || 0)
  const mode = String(body.mode || 'teach')
  const question = body.question
  const rashiForLine = String(body.rashiForLine || '')
  const tosafotForLine = String(body.tosafotForLine || '')
  const needWelcome = Boolean(body.needWelcome)
  const model = await geminiModel()

  let training = ''
  try {
    const hints = await trainingHintsForPrompt()
    if (hints) training = "\\nTester coaching notes (follow these when relevant):\\n" + (hints)
  } catch {
    training = ''
  }

  const context = [
    "Page: " + (gemaraRef) + " (line " + (lineIndex) + ")",
    "Center Hebrew: " + (clip(hebrewLine, 360)),
    "English crib: " + (clip(englishLine, 220)),
    "Rashi: " + (clip(rashiForLine, 220) || '(none)'),
    "Tosafot: " + (clip(tosafotForLine, 140) || '(none)'),
    buildCurriculumBlock(),
    training,
    needWelcome ? 'Include a one-sentence welcome in "welcome".' : 'Leave "welcome" empty.',
    mode === 'teach'
      ? 'Teach mode: fill hebrew, english, explain. Keep speech empty or short.'
      : mode === 'continue'
        ? 'Continue: next chunk of the same line (or deepen briefly). Fill hebrew/english/explain.'
        : 'Ask mode: put the spoken answer in "speech". hebrew/english may be empty.',
  ].join('\n')

  const history = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'model'))
    .slice(-4)
    .map((m) => {
      const content = clip(m.content, 360)
      const text =
        m.role === 'model'
          ? JSON.stringify({
              speech: content,
              hebrew: '',
              english: '',
              explain: '',
              welcome: '',
              highlights: [],
            })
          : content
      return {
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text }],
      }
    })

  const prompt =
    mode === 'teach'
      ? 'Teach the next short chunk now.'
      : mode === 'continue'
        ? 'Continue with the next short chunk.'
        : String(question || 'Please explain that more simply.')

  return withRetry(async () => {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + (model) + ":generateContent?key=" + (apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            { role: 'user', parts: [{ text: "Context:\\n" + (context) }] },
            {
              role: 'model',
              parts: [
                {
                  text: JSON.stringify({
                    welcome: '',
                    hebrew: '',
                    english: '',
                    explain: '',
                    speech: 'Ready.',
                    highlights: [],
                  }),
                },
              ],
            },
            ...history,
            { role: 'user', parts: [{ text: prompt }] },
          ],
          generationConfig: {
            maxOutputTokens: 220,
            temperature: 0.45,
            responseMimeType: 'application/json',
          },
        }),
      },
    )
    const data = await res.json()
    if (!res.ok) {
      throw httpError(data?.error?.message || "Gemini failed (" + (res.status) + ")", res.status)
    }
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '')
        .join('') || ''
    return parseLessonPayload(text, hebrewLine, englishLine)
  })
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i))
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function pcmToWavBase64(pcmBase64: string, sampleRate = 24000): string {
  const binary = atob(pcmBase64)
  const pcm = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) pcm[i] = binary.charCodeAt(i)
  const buffer = new ArrayBuffer(44 + pcm.length)
  const view = new DataView(buffer)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + pcm.length, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, pcm.length, true)
  new Uint8Array(buffer).set(pcm, 44)
  return arrayBufferToBase64(buffer)
}

async function requestGeminiSpeech(
  model: string,
  apiKey: string,
  spoken: string,
  voice: string,
) {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + (model) + ":generateContent?key=" + (apiKey),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "You are a calm professional adult male Jewish teacher speaking to one student. Speak naturally. Pronounce any Hebrew words carefully and correctly. Do not sound rushed:\\n" + (spoken),
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      }),
    },
  )
  const data = await res.json()
  if (!res.ok) {
    throw httpError(
      data?.error?.message || "Speech generation failed (" + (res.status) + ")",
      res.status,
    )
  }
  const part = data?.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data?: string } }) => p.inlineData?.data,
  )
  const inline = part?.inlineData
  if (!inline?.data) throw httpError('No audio returned from Gemini TTS', 500)
  const mime = String(inline.mimeType || '')
  const rateMatch = mime.match(/rate=(\d+)/i)
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000
  return {
    mimeType: 'audio/wav',
    audioBase64: pcmToWavBase64(inline.data, sampleRate),
    voice,
    source: 'gemini',
    text: spoken,
  }
}

export async function synthesizeRebbeSpeech(text: unknown, voiceName = 'Charon') {
  const apiKey = await geminiKey()
  if (!apiKey) throw httpError('Missing GEMINI_API_KEY', 500)
  const allowed = new Set(REBBE_VOICES.map((v) => v.id))
  const voice = allowed.has(voiceName) ? voiceName : 'Charon'
  const spoken = clip(String(text || '').trim(), 480)
  if (!spoken) throw httpError('Nothing to speak', 400)

  try {
    return await withRetry(
      async () => requestGeminiSpeech(await ttsModel(), apiKey, spoken, voice),
      1,
    )
  } catch (err) {
    return {
      mimeType: 'browser',
      audioBase64: '',
      voice,
      source: 'browser',
      text: spoken,
      warning: (err as { message?: string })?.message || 'Using local voice',
    }
  }
}

export function lessonResponse(lesson: LessonPayload, audio: unknown = null) {
  return {
    reply: lesson.speech || lesson.explain || '',
    welcome: lesson.welcome || '',
    hebrew: lesson.hebrew || '',
    english: lesson.english || '',
    explain: lesson.explain || '',
    highlights: lesson.highlights || [],
    audio,
  }
}
