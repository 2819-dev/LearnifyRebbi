import { GoogleGenerativeAI } from '@google/generative-ai'
import curriculum from '../src/data/hashavas-aveidah.json' with { type: 'json' }

export const APP_NAME = 'Guide'

export const SYSTEM_PROMPT = `You are a real classroom Rebbe inside Guide, teaching Jewish children (about ages 9–14) Gemara.

You are NOT a chatbot. You teach like you are standing in front of the class with the Gemara open.

HOW A REAL CLASS SOUNDS:
- Start by pointing at the line on the page: "Look at this line…" or "The Gemara says…"
- Translate the idea into clear English a child can follow.
- Explain WHY the Gemara is asking this, not only WHAT it says.
- Use simple classroom examples (a dollar on the sidewalk, a labeled water bottle, coins that spilled).
- Then check understanding with ONE short question, like: "So if it has no siman, what do we usually think happened?"
- Keep each turn to a short board-note: about 4–8 spoken sentences. Never lecture forever.
- If the child answers, respond like a Rebbe: praise careful thinking, gently correct, then push one step deeper.

STRICT ACCURACY:
- Use ONLY the current Gemara line and the curriculum notes provided.
- Do not invent Rashi, Tosafos, or later opinions.
- Do not give practical psak for a real-life case. Teach the sugya, then say to ask a real Rebbe/posek for a real case.
- If unsure, say so plainly.

VOICE ON THE PAGE:
- Write the exact words you would say out loud in class.
- Plain English. Short sentences. No markdown headings, no bullets, no emoji, no "As an AI".
- You may keep one Hebrew term in quotes and immediately explain it, e.g. "siman" — an identifying mark.`

export const REBBE_VOICES = [
  {
    id: 'Sadaltager',
    label: 'Steady Rebbe',
    blurb: 'Clear and knowledgeable — great for class.',
  },
  {
    id: 'Charon',
    label: 'Patient Rebbe',
    blurb: 'Calm and informative.',
  },
  {
    id: 'Gacrux',
    label: 'Warm Rebbe',
    blurb: 'Mature, gentle classroom tone.',
  },
  {
    id: 'Schedar',
    label: 'Even Rebbe',
    blurb: 'Steady pacing, easy to follow.',
  },
  {
    id: 'Alnilam',
    label: 'Firm Rebbe',
    blurb: 'Confident and focused.',
  },
]

export function buildCurriculumBlock() {
  return [
    `Topic: ${curriculum.title}`,
    `Overview: ${curriculum.overview}`,
    'Key concepts:',
    ...curriculum.concepts.map((x) => `- ${x.term}: ${x.kidExplanation}`),
    'Halacha anchors (teach as concepts, not psak):',
    ...curriculum.halachaAnchors.map((x) => `- ${x}`),
    'Teaching tips:',
    ...curriculum.teachingTips.map((x) => `- ${x}`),
  ].join('\n')
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
  } = body || {}

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    systemInstruction: SYSTEM_PROMPT,
  })

  const context = [
    `Current page: ${gemaraRef}`,
    `Line index: ${lineIndex}`,
    `Hebrew on the child's page: ${hebrewLine || '(empty)'}`,
    `Teacher crib notes only (William Davidson / Sefaria English — do NOT read this verbatim to the child; teach it in your own classroom English): ${englishLine || '(none)'}`,
    '',
    'CURRICULUM NOTES:',
    buildCurriculumBlock(),
    '',
    mode === 'teach'
      ? 'Open class on this line. Point to the Hebrew, explain it in English like a real Rebbe, then ask one check-in question.'
      : mode === 'continue'
        ? 'Continue the shiur from where you left off. Stay on this line unless the child is ready to move on.'
        : "The child asked a question. Answer like a Rebbe in class — clear, kind, and stuck to the sources.",
  ].join('\n')

  const history = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'model'))
    .slice(-12)
    .map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }))

  const chat = model.startChat({
    history: [
      {
        role: 'user',
        parts: [{ text: `Session context (not spoken by the child):\n${context}` }],
      },
      {
        role: 'model',
        parts: [
          {
            text: 'Understood. I will teach this line like a classroom Rebbe, in clear English, only from the Gemara and curriculum notes.',
          },
        ],
      },
      ...history,
    ],
  })

  const prompt =
    mode === 'teach'
      ? 'Please teach this line now, out loud, like class is starting.'
      : mode === 'continue'
        ? 'Please continue the shiur.'
        : String(question || 'Can you explain that again more simply?')

  const result = await chat.sendMessage(prompt)
  return result.response.text()
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

export async function synthesizeRebbeSpeech(text, voiceName = 'Sadaltager') {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    const error = new Error('Missing GEMINI_API_KEY')
    error.status = 500
    throw error
  }

  const allowed = new Set(REBBE_VOICES.map((v) => v.id))
  const voice = allowed.has(voiceName) ? voiceName : 'Sadaltager'
  const model =
    process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts'

  const spoken = String(text || '').trim()
  if (!spoken) {
    const error = new Error('Nothing to speak')
    error.status = 400
    throw error
  }

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
                text: `Speak as a warm, patient Gemara Rebbe teaching children in a quiet classroom. Natural pacing, clear English, no theatrics:\n\n${spoken}`,
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
      data?.error?.message ||
      `Speech generation failed (${res.status})`
    const error = new Error(message)
    error.status = 500
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
  const wavBase64 = pcmToWavBase64(inline.data, sampleRate)

  return {
    mimeType: 'audio/wav',
    audioBase64: wavBase64,
    voice,
  }
}
