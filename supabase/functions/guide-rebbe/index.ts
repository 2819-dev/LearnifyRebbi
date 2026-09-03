import { fail, json, optionsResponse } from '../_shared/http.ts'
import {
  generateRebbeReply,
  lessonResponse,
  REBBE_VOICES,
  synthesizeRebbeSpeech,
} from './_shared/rebbe.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  if (req.method === 'GET') {
    return json({ voices: REBBE_VOICES, ok: true, name: 'Guide' })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  try {
    if (body?.action === 'speak') {
      return json(
        await synthesizeRebbeSpeech(body.text, String(body.voice || 'Charon')),
      )
    }

    const lesson = await generateRebbeReply(body)
    let audio = null
    if (body?.includeSpeech !== false && !lesson.hebrew) {
      const firstText = lesson.welcome || lesson.speech || lesson.explain || ''
      if (firstText) {
        audio = await synthesizeRebbeSpeech(
          firstText,
          String(body.voice || 'Charon'),
        )
      }
    }
    return json(lessonResponse(lesson, audio))
  } catch (err) {
    console.error(err)
    return fail(err)
  }
})
