import { query } from './db.ts'
import { httpError } from './http.ts'
import { normalizePhone } from './crypto.ts'
import {
  ACCOUNT_COLS,
  accountFromToken,
  cleanAnswers,
  iso,
  publicAccount,
  publicLearningRequest,
  publicRabbiMessage,
  publicTicket,
  PublicAccount,
  PublicLearningRequest,
  PublicRabbiApplication,
  PublicRabbiMessage,
  PublicRabbiProfile,
  PublicTicket,
  rabbiStatusOf,
  requireApprovedRabbi,
  requireRole,
  AccountRow,
  AccountRole,
} from './account-core.ts'

export async function createRabbiWaitMessage(input: {
  token: string
  name?: unknown
  message?: unknown
}) {
  const account = input.token ? await accountFromToken(input.token) : null
  const message = String(input.message || '').trim().slice(0, 2000)
  if (message.length < 3) throw httpError('Write a short message for the rebbeim', 400)
  const name = String(input.name || account?.username || 'Student').trim().slice(0, 80) || 'Student'
  const rows = await query(
    `insert into guide.rabbi_messages (account_id, name, message, status)
     values ($1::uuid, $2, $3, 'open')
     returning id, account_id, name, message, status, created_at`,
    [account?.id || null, name, message],
  )
  return publicRabbiMessage(rows[0] as Parameters<typeof publicRabbiMessage>[0])
}

export async function listRabbiWaitMessages(token: string) {
  await requireRole(token, ['admin'])
  const rows = await query(
    `select id, account_id, name, message, status, created_at
     from guide.rabbi_messages
     order by created_at desc
     limit 200`,
  )
  return (rows as Parameters<typeof publicRabbiMessage>[0][]).map(publicRabbiMessage)
}

export async function updateRabbiWaitMessage(
  token: string,
  messageId: unknown,
  status: unknown,
) {
  await requireRole(token, ['admin'])
  if (!['open', 'closed'].includes(String(status))) {
    throw httpError('Invalid status', 400)
  }
  const rows = await query(
    `update guide.rabbi_messages set status = $1
     where id = $2::uuid
     returning id, account_id, name, message, status, created_at`,
    [String(status), String(messageId)],
  )
  if (!rows[0]) throw httpError('Message not found', 404)
  return publicRabbiMessage(rows[0] as Parameters<typeof publicRabbiMessage>[0])
}

export async function createTicket(input: {
  token: string
  name?: unknown
  phone?: unknown
  subject?: unknown
  body?: unknown
}) {
  const account = input.token ? await accountFromToken(input.token) : null
  const body = String(input.body || '').trim().slice(0, 4000)
  if (!body) throw httpError('Write a short message', 400)

  let accountPhone = ''
  if (account) {
    const rows = await query<{ phone: string }>(
      'select phone from guide.accounts where id = $1::uuid limit 1',
      [account.id],
    )
    accountPhone = String(rows[0]?.phone || '')
  }

  const rows = await query(
    'insert into guide.tickets (account_id, name, phone, subject, body, status) values ($1::uuid, $2, $3, $4, $5, \'open\') returning id, account_id, name, subject, body, status, created_at',
    [
      account?.id || null,
      String(input.name || account?.username || 'Guest').trim().slice(0, 80),
      normalizePhone(input.phone || accountPhone),
      String(input.subject || '').trim().slice(0, 120) || 'Help',
      body,
    ],
  )
  return publicTicket(rows[0] as Parameters<typeof publicTicket>[0])
}

export async function listTickets(token: string) {
  await requireRole(token, ['admin'])
  const rows = await query(
    'select id, account_id, name, subject, body, status, created_at from guide.tickets order by created_at desc',
  )
  return (rows as Parameters<typeof publicTicket>[0][]).map(publicTicket)
}

export async function updateTicket(token: string, ticketId: unknown, status: unknown) {
  await requireRole(token, ['admin'])
  if (!['open', 'in_progress', 'closed'].includes(String(status))) {
    throw httpError('Invalid status', 400)
  }
  const rows = await query(
    'update guide.tickets set status = $1 where id = $2::uuid returning id, account_id, name, subject, body, status, created_at',
    [String(status), String(ticketId)],
  )
  if (!rows[0]) throw httpError('Ticket not found', 404)
  return publicTicket(rows[0] as Parameters<typeof publicTicket>[0])
}

export async function listTraining(token: string) {
  await requireRole(token, ['admin', 'tester'])
  const rows = await query(
    'select id, tester_id, tester_username, prompt, ai_response, correction, created_at from guide.training order by created_at desc limit 200',
  )
  return rows.map((row) => ({
    id: row.id,
    testerId: row.tester_id,
    testerUsername: row.tester_username,
    prompt: row.prompt,
    aiResponse: row.ai_response,
    correction: row.correction,
    createdAt: iso(row.created_at),
  }))
}

export async function addTraining(token: string, entry: Record<string, unknown>) {
  const account = await requireRole(token, ['admin', 'tester'])
  const prompt = String(entry.prompt || '').trim().slice(0, 2000)
  const correction = String(entry.correction || '').trim().slice(0, 4000)
  if (!prompt || !correction) throw httpError('Prompt and correction are required', 400)

  const rows = await query(
    'insert into guide.training (tester_id, tester_username, prompt, ai_response, correction) values ($1::uuid, $2, $3, $4, $5) returning id, tester_id, tester_username, prompt, ai_response, correction, created_at',
    [
      account.id,
      account.username,
      prompt,
      String(entry.aiResponse || '').trim().slice(0, 4000),
      correction,
    ],
  )
  await query(
    'delete from guide.training where id in (select id from guide.training order by created_at desc offset 200)',
  )
  const row = rows[0]
  return {
    id: row.id,
    testerId: row.tester_id,
    testerUsername: row.tester_username,
    prompt: row.prompt,
    aiResponse: row.ai_response,
    correction: row.correction,
    createdAt: iso(row.created_at),
  }
}

