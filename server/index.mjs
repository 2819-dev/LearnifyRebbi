import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const envPath = join(root, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

const curriculum = JSON.parse(
  readFileSync(join(root, 'src/data/hashavas-aveidah.json'), 'utf8'),
)

const app = new Hono()
app.use('/api/*', cors())

const SYSTEM_PROMPT = `You are "Rebbe" inside Lomed — a warm, patient Gemara teacher for Jewish children (roughly ages 9–14).

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

app.get('/api/health', (c) => c.json({ ok: true, name: 'Lomed' }))

app.post('/api/rebbe', async (c) => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return c.json(
      {
        error:
          'Missing GEMINI_API_KEY. Create a free key at https://aistudio.google.com/apikey and put it in .env',
      },
      500,
    )
  }

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const {
    messages = [],
    gemaraRef = '',
    hebrewLine = '',
    englishLine = '',
    lineIndex = 0,
    mode = 'teach',
  } = body

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  })

  const curriculumBlock = [
    `Topic: ${curriculum.title}`,
    `Overview: ${curriculum.overview}`,
    'Key concepts:',
    ...curriculum.concepts.map(
      (x) => `- ${x.term}: ${x.kidExplanation}`,
    ),
    'Halacha anchors (teach as concepts, not psak):',
    ...curriculum.halachaAnchors.map((x) => `- ${x}`),
    'Teaching tips:',
    ...curriculum.teachingTips.map((x) => `- ${x}`),
  ].join('\n')

  const context = [
    `Current page: ${gemaraRef}`,
    `Line index: ${lineIndex}`,
    `Hebrew on screen: ${hebrewLine || '(empty)'}`,
    `Reference English (William Davidson / Sefaria, for YOUR grounding only — do not read it word-for-word to the child): ${englishLine || '(none)'}`,
    '',
    'CURRICULUM NOTES:',
    curriculumBlock,
    '',
    mode === 'teach'
      ? 'The child just opened or advanced to this line. Teach this line warmly. Start by telling them what we are looking at, then explain it.'
      : mode === 'continue'
        ? 'Continue the lesson naturally from the conversation so far.'
        : 'Answer the child\'s question carefully using only the provided text and curriculum.',
  ].join('\n')

  const history = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'model'))
    .slice(-12)
    .map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }))

  try {
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
          : String(body.question || 'Can you explain that again more simply?')

    const result = await chat.sendMessage(prompt)
    const text = result.response.text()
    return c.json({ reply: text })
  } catch (err) {
    console.error(err)
    return c.json(
      {
        error:
          err?.message ||
          'The Rebbe could not answer right now. Check your Gemini free-tier key and try again.',
      },
      500,
    )
  }
})

const port = Number(process.env.PORT || 8787)
console.log(`Lomed Rebbe API on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
