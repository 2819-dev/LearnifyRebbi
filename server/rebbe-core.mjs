import { GoogleGenerativeAI } from '@google/generative-ai'
import curriculum from '../src/data/hashavas-aveidah.json' with { type: 'json' }

export const APP_NAME = 'Guide'

export const SYSTEM_PROMPT = `You are a Rebbe learning one-on-one with a Jewish child (about 9–14) in Guide.

This is NOT a classroom speech to a group. Talk only to THIS student, like you are sitting across the table with one open Gemara.

HOW YOU SOUND:
- Speak to "you", never "everyone", never "class", never "boys", never "sit down".
- Point at the page: "Look here…" / "See what Rashi says on the side…"
- Main language: clear English.
- Hebrew: use Hebrew words when teaching the Gemara term, and explain them. If the student asks in Hebrew or asks what a Hebrew word means, answer that.
- Keep it VERY short: 2 to 4 spoken sentences. Then stop. One short check-in question only if it helps.
- Warm, patient, real. Not theatrical. Not a chatbot.

STRICT ACCURACY:
- Use ONLY the Gemara line, any Rashi/Tosafot provided, and the curriculum notes.
- Do not invent meforshim.
- No practical psak for real life — teach the sugya; for a real case tell them to ask their real Rebbe.
- If unsure, say so.

OUTPUT:
- Exactly what you would say out loud.
- No markdown, no bullets, no emoji, no stage directions.`

export const REBBE_VOICES = [
  {
    id: 'Sadaltager',
    label: 'Steady',
    blurb: 'Clear and knowledgeable.',
  },
  {
    id: 'Charon',
    label: 'Patient',
    blurb: 'Calm and careful.',
  },
  {
    id: 'Gacrux',
    label: 'Warm',
    blurb: 'Gentle and mature.',
  },
  {
    id: 'Schedar',
    label: 'Even',
    blurb: 'Steady pacing.',
  },
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
    ...curriculum.concepts.slice(0, 4).map((x) => `- ${x.term}: ${x.kidExplanation}`),
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
      await new Promise((r) => setTimeout(r, 800 * (i + 1) * (i + 1)))
    }
  }
  throw lastErr
}

export async function generateRebbeReply(body) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    const error = new Error(
      'Missing GEMINI_API_KEY. Set it in Netlify env or local .env',
    )
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
  } = body || {}

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 220,
      temperature: 0.6,
    },
  })

  const context = [
    `Page: ${gemaraRef} (line ${lineIndex})`,
    `Center Hebrew: ${clip(hebrewLine, 360)}`,
    `English crib (do not read verbatim): ${clip(englishLine, 280)}`,
    `Rashi for this line: ${clip(rashiForLine, 280) || '(none)'}`,
    `Tosafot for this line: ${clip(tosafotForLine, 180) || '(none)'}`,
    buildCurriculumBlock(),
    mode === 'teach'
      ? 'Teach this line to the one student in front of you. Very short.'
      : mode === 'continue'
        ? 'Continue briefly with the same student.'
        : 'Answer the student. They may mix English and Hebrew.',
  ].join('\n')

  const history = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'model'))
    .slice(-6)
    .map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: clip(m.content, 500) }],
    }))

  return withRetry(async () => {
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: `Context:\n${context}` }],
        },
        {
          role: 'model',
          parts: [{ text: 'Understood. Short one-on-one teaching only.' }],
        },
        ...history,
      ],
    })

    const prompt =
      mode === 'teach'
        ? 'Teach this line now.'
        : mode === 'continue'
          ? 'Continue briefly.'
          : String(question || 'Please explain that more simply.')

    const result = await chat.sendMessage(prompt)
    return clip(result.response.text(), 700)
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
                text: `Speak warmly to one student, natural and calm:\n${spoken}`,
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
  }
}

export async function synthesizeRebbeSpeech(text, voiceName = 'Sadaltager') {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    const error = new Error('Missing GEMINI_API_KEY')
    error.status = 500
    throw error
  }

  const allowed = new Set(REBBE_VOICES.map((v) => v.id))
  const voice = allowed.has(voiceName) ? voiceName : 'Sadaltager'
  const spoken = clip(String(text || '').trim(), 520)
  if (!spoken) {
    const error = new Error('Nothing to speak')
    error.status = 400
    throw error
  }

  const cacheKey = `${voice}::${spoken}`
  if (speechCache.has(cacheKey)) return speechCache.get(cacheKey)

  let lastErr
  for (const model of [...new Set(TTS_MODELS)]) {
    try {
      const payload = await withRetry(() =>
        requestGeminiSpeech(model, apiKey, spoken, voice),
      )
      if (speechCache.size > 40) speechCache.clear()
      speechCache.set(cacheKey, payload)
      return payload
    } catch (err) {
      lastErr = err
      const msg = String(err?.message || '')
      // try next model on quota / not found
      if (!/429|quota|rate|404|not found|no longer available/i.test(msg)) {
        break
      }
    }
  }

  // Signal client to use local speaker voice so the student still hears something.
  return {
    mimeType: 'browser',
    audioBase64: '',
    voice,
    source: 'browser',
    text: spoken,
    warning: lastErr?.message || 'Gemini speech quota reached',
  }
}
