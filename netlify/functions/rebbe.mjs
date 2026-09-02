import { generateRebbeReply, synthesizeRebbeSpeech, REBBE_VOICES } from '../../server/rebbe-core.mjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return Response.json({ voices: REBBE_VOICES }, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: corsHeaders },
    )
  }

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders },
    )
  }

  try {
    if (body?.action === 'speak') {
      const spoken = await synthesizeRebbeSpeech(body.text, body.voice)
      return Response.json(spoken, { headers: corsHeaders })
    }

    const reply = await generateRebbeReply(body)
    return Response.json({ reply }, { headers: corsHeaders })
  } catch (err) {
    console.error(err)
    return Response.json(
      {
        error:
          err?.message ||
          'The Rebbe could not answer right now. Check your Gemini key and try again.',
      },
      { status: err?.status || 500, headers: corsHeaders },
    )
  }
}

export const config = {
  path: '/api/rebbe',
}
