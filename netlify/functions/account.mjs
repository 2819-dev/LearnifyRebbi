import {
  accountFromToken,
  addTraining,
  createTicket,
  listTickets,
  listTraining,
  listUsers,
  loginAccount,
  logoutAccount,
  registerAccount,
  setUserRole,
  updateTicket,
} from '../../server/account-core.mjs'
import { generateRebbeReply } from '../../server/rebbe-core.mjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function tokenFrom(req, body) {
  const header = req.headers.get('authorization') || ''
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return body?.token || ''
}

function errResponse(err) {
  return Response.json(
    { error: err?.message || 'Request failed' },
    { status: err?.status || 500, headers: corsHeaders },
  )
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders })
  }

  let body = {}
  if (req.method !== 'GET') {
    try {
      body = await req.json()
    } catch {
      body = {}
    }
  }

  const url = new URL(req.url)
  const action =
    body.action || url.searchParams.get('action') || (req.method === 'GET' ? 'me' : '')

  try {
    if (action === 'register') {
      const result = await registerAccount(body)
      return Response.json(result, { headers: corsHeaders })
    }
    if (action === 'login') {
      const result = await loginAccount(body)
      return Response.json(result, { headers: corsHeaders })
    }
    if (action === 'logout') {
      await logoutAccount(tokenFrom(req, body))
      return Response.json({ ok: true }, { headers: corsHeaders })
    }
    if (action === 'me') {
      const account = await accountFromToken(tokenFrom(req, body))
      return Response.json({ account }, { headers: corsHeaders })
    }
    if (action === 'users') {
      const users = await listUsers(tokenFrom(req, body))
      return Response.json({ users }, { headers: corsHeaders })
    }
    if (action === 'setRole') {
      const account = await setUserRole(
        tokenFrom(req, body),
        body.accountId,
        body.role,
      )
      return Response.json({ account }, { headers: corsHeaders })
    }
    if (action === 'createTicket') {
      const ticket = await createTicket({
        token: tokenFrom(req, body),
        name: body.name,
        phone: body.phone,
        subject: body.subject,
        body: body.body,
      })
      return Response.json({ ticket }, { headers: corsHeaders })
    }
    if (action === 'tickets') {
      const tickets = await listTickets(tokenFrom(req, body))
      return Response.json({ tickets }, { headers: corsHeaders })
    }
    if (action === 'updateTicket') {
      const ticket = await updateTicket(
        tokenFrom(req, body),
        body.ticketId,
        body.status,
      )
      return Response.json({ ticket }, { headers: corsHeaders })
    }
    if (action === 'trainingList') {
      const training = await listTraining(tokenFrom(req, body))
      return Response.json({ training }, { headers: corsHeaders })
    }
    if (action === 'trainingSave') {
      const row = await addTraining(tokenFrom(req, body), body)
      return Response.json({ training: row }, { headers: corsHeaders })
    }
    if (action === 'trainingChat') {
      await accountFromToken(tokenFrom(req, body)) // any signed-in tester/admin checked below
      const { requireRole } = await import('../../server/account-core.mjs')
      await requireRole(tokenFrom(req, body), ['admin', 'tester'])
      const lesson = await generateRebbeReply({
        messages: body.messages || [],
        gemaraRef: body.gemaraRef || 'Training desk',
        hebrewLine: body.hebrewLine || '',
        englishLine: body.englishLine || '',
        lineIndex: 0,
        mode: 'ask',
        question: body.question || 'Practice reply.',
        rashiForLine: '',
        tosafotForLine: '',
        needWelcome: false,
      })
      return Response.json(
        {
          reply: lesson.speech || lesson.explain || '',
          highlights: lesson.highlights || [],
        },
        { headers: corsHeaders },
      )
    }

    return Response.json(
      { error: 'Unknown action' },
      { status: 400, headers: corsHeaders },
    )
  } catch (err) {
    console.error(err)
    return errResponse(err)
  }
}

export const config = {
  path: '/api/account',
}
