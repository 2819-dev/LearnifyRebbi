import { GoogleGenerativeAI } from '@google/generative-ai'
import curriculum from '../src/data/hashavas-aveidah.json' with { type: 'json' }

export const APP_NAME = 'Guide'

export const SYSTEM_PROMPT = `You are a warm, professional male Rebbe tutoring ONE Jewish child (about 9–14) in Guide.

Never speak to a class. Never say everyone or sit down.

VOICE:
- Calm adult man. Clear. Kind. Not theatrical.
- English is the main language.
- Pronounce Hebrew carefully and correctly when you say Hebrew words.

TEACH / CONTINUE PEDAGOGY (important):
1) Pick a short chunk from the Gemara line — about 2 to 4 words (not one isolated word unless it is a key term alone).
2) The student will hear: Hebrew chunk → English meaning → then they repeat.
3) After they repeat, you give a tiny explanation (1–2 sentences).

ASK MODE:
- Answer briefly and clearly.

STRICT ACCURACY:
- Use ONLY the Gemara line, Rashi/Tosafot provided, and curriculum notes.
- No invented meforshim. No practical real-life psak.

OUTPUT — ONLY valid JSON:
{
  "welcome": "empty string usually; one short welcome only if asked",
  "hebrew": "2–4 Hebrew words from the line",
  "english": "plain English meaning of that chunk",
  "explain": "1–2 spoken sentences after the student repeats",
  "speech": "for ask/continue free talk: what you say out loud; otherwise empty",
  "highlights": [
    { "word": "Hebrew word from the line", "kind": "term|rashi|focus|reading" }
  ]
}
Keep every spoken field short. Prefer 1–3 highlights.`

export const REBBE_VOICES = [
  { id: 'Charon', label: 'Teacher', blurb: 'Warm professional man.' },
  { id: 'Sadaltager', label: 'Steady', blurb: 'Clear and knowledgeable.' },
  { id: 'Schedar', label: 'Even', blurb: 'Calm and measured.' },
  { id: 'Gacrux', label: 'Warm', blurb: 'Gentle pacing.' },
]

function clip(text, max = 420) {
  const s = String(text || '').trim()
  if (s.length <= max) return s
  return `${s.slice(0, max)}…`
}

export function buildCurriculumBlock() {
  return [
    `Topic: ${curriculum.title}`,
    `Overview: ${curriculum.overview}`,
    'Key ideas:',
    ...curriculum.concepts
      .slice(0, 4)
      .map((x) => `- ${x.term}: ${x.kidExplanation}`),
  ].join('\n')
}

async function withRetry(fn, tries = 3) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const status = err?.status || err?.statusCode
      const msg = String(err?.message || '')
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
  const words = String(hebrewLine)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
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

function parseLessonPayload(raw, hebrewLine = '', englishLine = '') {
  const text = String(raw || '').trim()
  const fallback = chunkHebrewFallback(hebrewLine, englishLine)
  try {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1))
      const highlights = Array.isArray(parsed.highlights)
        ? parsed.highlights
            .map((h) => ({
              word: String(h.word || '').trim(),
              kind: ['reading', 'term', 'rashi', 'focus'].includes(h.kind)
                ? h.kind
                : 'term',
            }))
            .filter((h) => h.word)
            .slice(0, 6)
        : []

      const hebrew = clip(parsed.hebrew || fallback.hebrew, 120)
      const english = clip(parsed.english || fallback.english, 160)
      const explain = clip(parsed.explain || fallback.explain, 280)
      const welcome = clip(parsed.welcome || '', 160)
      const speech = clip(
        parsed.speech ||
          [hebrew && `Hebrew: ${hebrew}`, english && `That means: ${english}`, explain]
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

export async function generateRebbeReply(body) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    const error = new Error('Missing GEMINI_API_KEY')
    error.status = 500
    throw error
  }

  const {
    messages = [],
    gemaraRef = '',
    hebrewLine = '',
    englishLine = '',
    lineIndex = 0,
    mode = 'teach',
    question,
    rashiForLine = '',
    tosafotForLine = '',
    needWelcome = false,
  } = body || {}

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 220,
      temperature: 0.45,
      responseMimeType: 'application/json',
    },
  })

  const context = [
    `Page: ${gemaraRef} (line ${lineIndex})`,
    `Center Hebrew: ${clip(hebrewLine, 360)}`,
    `English crib: ${clip(englishLine, 220)}`,
    `Rashi: ${clip(rashiForLine, 220) || '(none)'}`,
    `Tosafot: ${clip(tosafotForLine, 140) || '(none)'}`,
    buildCurriculumBlock(),
    needWelcome
      ? 'Include a one-sentence welcome in "welcome".'
      : 'Leave "welcome" empty.',
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

  return withRetry(async () => {
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: `Context:\n${context}` }],
        },
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
      ],
    })

    const prompt =
      mode === 'teach'
        ? 'Teach the next short chunk now.'
        : mode === 'continue'
          ? 'Continue with the next short chunk.'
          : String(question || 'Please explain that more simply.')

    const result = await chat.sendMessage(prompt)
    return parseLessonPayload(result.response.text(), hebrewLine, englishLine)
  })
}

function pcmToWavBase64(pcmBase64, sampleRate = 24000) {
  const pcm = Buffer.from(pcmBase64, 'base64')
  const header = Buffer.alloc(44)
  const dataSize = pcm.length
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  return Buffer.concat([header, pcm]).toString('base64')
}

const speechCache = new Map()

const TTS_MODELS = [
  process.env.GEMINI_TTS_MODEL,
  'gemini-2.5-flash-preview-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-pro-preview-tts',
].filter(Boolean)

async function requestGeminiSpeech(model, apiKey, spoken, voice) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a calm professional adult male Jewish teacher speaking to one student. Speak naturally. Pronounce any Hebrew words carefully and correctly. Do not sound rushed:\n${spoken}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
        },
      }),
    },
  )

  const data = await res.json()
  if (!res.ok) {
    const message =
      data?.error?.message || `Speech generation failed (${res.status})`
    const error = new Error(message)
    error.status = res.status
    throw error
  }

  const part = data?.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data,
  )
  const inline = part?.inlineData
  if (!inline?.data) {
    const error = new Error('No audio returned from Gemini TTS')
    error.status = 500
    throw error
  }

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

export async function synthesizeRebbeSpeech(text, voiceName = 'Charon') {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    const error = new Error('Missing GEMINI_API_KEY')
    error.status = 500
    throw error
  }

  const allowed = new Set(REBBE_VOICES.map((v) => v.id))
  const voice = allowed.has(voiceName) ? voiceName : 'Charon'
  const spoken = clip(String(text || '').trim(), 480)
  if (!spoken) {
    const error = new Error('Nothing to speak')
    error.status = 400
    throw error
  }

  const cacheKey = `${voice}::${spoken}`
  if (speechCache.has(cacheKey)) return speechCache.get(cacheKey)

  let lastErr
  // One quick attempt — free TTS quota is tiny; browser voice is the backup.
  for (const model of [...new Set(TTS_MODELS)].slice(0, 1)) {
    try {
      const payload = await withRetry(
        () => requestGeminiSpeech(model, apiKey, spoken, voice),
        1,
      )
      if (speechCache.size > 40) speechCache.clear()
      speechCache.set(cacheKey, payload)
      return payload
    } catch (err) {
      lastErr = err
      break
    }
  }

  return {
    mimeType: 'browser',
    audioBase64: '',
    voice,
    source: 'browser',
    text: spoken,
    warning: lastErr?.message || 'Using local voice',
  }
}
