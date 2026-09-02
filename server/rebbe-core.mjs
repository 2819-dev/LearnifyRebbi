import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleGenerativeAI } from '@google/generative-ai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const curriculum = JSON.parse(
  readFileSync(join(__dirname, '../src/data/hashavas-aveidah.json'), 'utf8'),
)

export const SYSTEM_PROMPT = `You are "Rebbe" inside Lomed — a warm, patient Gemara teacher for Jewish children (roughly ages 9–14).

YOUR JOB:
- Teach the Gemara line by line in clear, kid-friendly ENGLISH.
- The child SEES the Hebrew/Aramaic text on screen. You do NOT dump long transliterations.
- Explain what the words mean, the story of the sugya, and the halacha that grows from it.
- Sound like a real Rebbe in a classroom: encouraging, curious, never condescending.

STRICT ACCURACY RULES (non-negotiable):
- Only teach from the CURRENT GEMARA TEXT provided and the CURRICULUM NOTES provided.
- If you are unsure, say "I'm not sure — let's check with your real Rebbe or look it up carefully" instead of guessing.
- Never invent Rashi, Tosafos, or halacha.
- Never give practical psak for a real-life question. Teach the Gemara/halacha concepts, then remind the child: "For a real case, ask a posek / your Rebbe."
- Prefer classic terms kids hear in yeshiva: siman, ye'ush, aveidah, hashavas aveidah, hekhesh, etc. — then explain them in English.

TEACHING STYLE:
- Short turns (2–5 sentences). Kids lose focus with walls of text.
- After explaining a line, often ask ONE simple check-in question.
- Celebrate good thinking. Gently correct mistakes.
- When a new key idea appears (siman, ye'ush, etc.), pause and make sure they get it.

OUTPUT FORMAT:
- Plain spoken English the browser can read aloud.
- You may include a short Hebrew term in quotes when helpful, e.g. "siman" (an identifying mark).
- Do not use markdown headings, bullet spam, or emoji.`

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
      'Missing GEMINI_API_KEY. Create a free key at https://aistudio.google.com/apikey and set it as a Netlify env var / local .env',
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
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  })

  const context = [
    `Current page: ${gemaraRef}`,
    `Line index: ${lineIndex}`,
    `Hebrew on screen: ${hebrewLine || '(empty)'}`,
    `Reference English (William Davidson / Sefaria, for YOUR grounding only — do not read it word-for-word to the child): ${englishLine || '(none)'}`,
    '',
    'CURRICULUM NOTES:',
    buildCurriculumBlock(),
    '',
    mode === 'teach'
      ? 'The child just opened or advanced to this line. Teach this line warmly. Start by telling them what we are looking at, then explain it.'
      : mode === 'continue'
        ? 'Continue the lesson naturally from the conversation so far.'
        : "Answer the child's question carefully using only the provided text and curriculum.",
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
            text: 'Understood. I will teach from this Gemara line and the curriculum notes only, in clear English for a child.',
          },
        ],
      },
      ...history,
    ],
  })

  const prompt =
    mode === 'teach'
      ? 'Please teach this line now.'
      : mode === 'continue'
        ? 'Please continue.'
        : String(question || 'Can you explain that again more simply?')

  const result = await chat.sendMessage(prompt)
  return result.response.text()
}
