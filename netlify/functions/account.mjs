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
  safeErrorMessage,
  scrubPii,
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

function ok(payload, status = 200) {
  return Response.json(scrubPii(payload), { status, headers: corsHeaders })
}

function errResponse(err) {
  return ok({ error: safeErrorMessage(err) }, err?.status || 500)
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
      return ok(result)
    }
    if (action === 'login') {
      const result = await loginAccount(body)
      return ok(result)
    }
    if (action === 'logout') {
      await logoutAccount(tokenFrom(req, body))
      return ok({ ok: true })
    }
    if (action === 'me') {
      const account = await accountFromToken(tokenFrom(req, body))
      return ok({ account })
    }
    if (action === 'users') {
      const users = await listUsers(tokenFrom(req, body))
      return ok({ users })
    }
    if (action === 'setRole') {
      const account = await setUserRole(
        tokenFrom(req, body),
        body.accountId,
        body.role,
      )
      return ok({ account })
    }
    if (action === 'createTicket') {
      const ticket = await createTicket({
        token: tokenFrom(req, body),
        name: body.name,
        phone: body.phone,
        subject: body.subject,
        body: body.body,
      })
      return ok({ ticket })
    }
    if (action === 'tickets') {
      const tickets = await listTickets(tokenFrom(req, body))
      return ok({ tickets })
    }
    if (action === 'updateTicket') {
      const ticket = await updateTicket(
        tokenFrom(req, body),
        body.ticketId,
        body.status,
      )
      return ok({ ticket })
    }
    if (action === 'trainingList') {
      const training = await listTraining(tokenFrom(req, body))
      return ok({ training })
    }
    if (action === 'trainingSave') {
      const row = await addTraining(tokenFrom(req, body), body)
      return ok({ training: row })
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
      return ok({
        reply: lesson.speech || lesson.explain || '',
        highlights: lesson.highlights || [],
      })
    }

    return ok({ error: 'Unknown action' }, 400)
  } catch (err) {
    console.error(safeErrorMessage(err), err?.status || 500)
    return errResponse(err)
  }
}

export const config = {
  path: '/api/account',
}
