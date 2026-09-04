import { setting } from './db.ts'
import { httpError } from './http.ts'
import { trainingHintsForPrompt } from './hints.ts'
import {
  SYSTEM_PROMPT,
  REBBE_VOICES,
  LessonPayload,
  ChatMessage,
  clip,
  buildCurriculumBlock,
  geminiKey,
  geminiModel,
  groqKey,
  groqVoiceFor,
  ttsModelCandidates,
  withRetry,
  parseLessonPayload,
} from './rebbe-lib.ts'

export { REBBE_VOICES }

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

async function requestGroqSpeech(apiKey: string, spoken: string, guideVoice: string) {
  const voice = groqVoiceFor(guideVoice)
  const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'canopylabs/orpheus-v1-english',
      voice,
      input: spoken,
      response_format: 'wav',
    }),
  })
  if (!res.ok) {
    let detail = 'Groq TTS failed (' + res.status + ')'
    try {
      const err = await res.json()
      detail = String(err?.error?.message || err?.message || detail)
    } catch {
      // ignore
    }
    throw httpError(detail, res.status)
  }
  const buf = new Uint8Array(await res.arrayBuffer())
  if (!buf.length) throw httpError('No audio returned from Groq TTS', 500)
  return {
    mimeType: 'audio/wav',
    audioBase64: arrayBufferToBase64(buf.buffer),
    voice: guideVoice,
    source: 'groq',
    text: spoken,
  }
}

/** Free no-key TTS via Google Translate (chunked MP3). */
function splitSpeechChunks(text: string, max = 160): string[] {
  const parts = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?。])\s+/)
  const chunks: string[] = []
  let cur = ''
  for (const part of parts) {
    if (!part) continue
    if ((cur + ' ' + part).trim().length <= max) {
      cur = (cur + ' ' + part).trim()
    } else {
      if (cur) chunks.push(cur)
      if (part.length <= max) cur = part
      else {
        // Hard-split long segments
        for (let i = 0; i < part.length; i += max) {
          chunks.push(part.slice(i, i + max))
        }
        cur = ''
      }
    }
  }
  if (cur) chunks.push(cur)
  return chunks.length ? chunks : [text.slice(0, max)]
}

function looksMostlyHebrew(text: string): boolean {
  const letters = text.replace(/\s+/g, '')
  if (!letters) return false
  const he = (letters.match(/[\u0590-\u05FF]/g) || []).length
  return he / letters.length > 0.4
}

async function requestFreeGoogleSpeech(spoken: string, guideVoice: string) {
  const lang = looksMostlyHebrew(spoken) ? 'iw' : 'en'
  const chunks = splitSpeechChunks(spoken, 160)
  const pieces: Uint8Array[] = []
  for (const chunk of chunks) {
    const url =
      'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' +
      lang +
      '&q=' +
      encodeURIComponent(chunk)
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    if (!res.ok) {
      throw httpError('Free TTS failed (' + res.status + ')', res.status)
    }
    pieces.push(new Uint8Array(await res.arrayBuffer()))
  }
  const total = pieces.reduce((n, p) => n + p.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const p of pieces) {
    merged.set(p, offset)
    offset += p.length
  }
  if (!merged.length) throw httpError('No audio returned from free TTS', 500)
  return {
    mimeType: 'audio/mpeg',
    audioBase64: arrayBufferToBase64(merged.buffer),
    voice: guideVoice,
    source: 'free',
    text: spoken,
  }
}

export async function synthesizeRebbeSpeech(text: unknown, voiceName = 'Charon') {
  const allowed = new Set(REBBE_VOICES.map((v) => v.id))
  const voice = allowed.has(voiceName) ? voiceName : 'Charon'
  const spoken = clip(String(text || '').trim(), 480)
  if (!spoken) throw httpError('Nothing to speak', 400)

  const errors: string[] = []

  // 1) Free Google Translate TTS — no API key, avoids Gemini free-tier silence
  try {
    return await withRetry(async () => requestFreeGoogleSpeech(spoken, voice), 2)
  } catch (err) {
    const msg = String((err as { message?: string })?.message || err)
    console.error('Free TTS failed', msg)
    errors.push(msg)
  }

  // 2) Groq Orpheus (optional key) — fast when billed/available
  const groq = await groqKey()
  if (groq) {
    try {
      return await withRetry(async () => requestGroqSpeech(groq, spoken, voice), 2)
    } catch (err) {
      const msg = String((err as { message?: string })?.message || err)
      console.error('Groq TTS failed', msg)
      errors.push(msg)
    }
  }

  // 3) Gemini TTS (optional key) — quality, but free-tier often capped
  const gemini = await geminiKey()
  if (gemini) {
    const models = await ttsModelCandidates()
    for (const model of models) {
      try {
        return await withRetry(
          async () => requestGeminiSpeech(model, gemini, spoken, voice),
          2,
        )
      } catch (err) {
        const msg = String((err as { message?: string })?.message || err)
        console.error('Gemini TTS failed for', model, msg)
        errors.push(msg)
      }
    }
  }

  return {
    mimeType: 'browser',
    audioBase64: '',
    voice,
    source: 'browser',
    text: spoken,
    warning: errors[0] || 'Using local voice',
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
