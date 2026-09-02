import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  generateRebbeReply,
  synthesizeRebbeSpeech,
  REBBE_VOICES,
} from './rebbe-core.mjs'

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

const app = new Hono()
app.use('/api/*', cors())

app.get('/api/health', (c) => c.json({ ok: true, name: 'Guide' }))
app.get('/api/voices', (c) => c.json({ voices: REBBE_VOICES }))

function lessonResponse(lesson, audio = null) {
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

app.post('/api/rebbe', async (c) => {
  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  try {
    if (body?.action === 'speak') {
      const spoken = await synthesizeRebbeSpeech(body.text, body.voice)
      return c.json(spoken)
    }

    const lesson = await generateRebbeReply(body)
    let audio = null
    if (body?.includeSpeech !== false && !lesson.hebrew) {
      const firstText = lesson.welcome || lesson.speech || lesson.explain || ''
      if (firstText) {
        audio = await synthesizeRebbeSpeech(firstText, body.voice)
      }
    }
    return c.json(lessonResponse(lesson, audio))
  } catch (err) {
    console.error(err)
    return c.json(
      {
        error:
          err?.message ||
          'The Rebbe could not answer right now. Check your Gemini key and try again.',
      },
      err?.status || 500,
    )
  }
})

const port = Number(process.env.PORT || 8787)
console.log(`Guide Rebbe API on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
