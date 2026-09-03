import {
  digestMatches,
  hashPassword,
  normalizePhone,
  phoneDigestHex,
  randomToken,
  sha256Hex,
  verifyPassword,
} from './crypto.ts'
import { query, setting } from './db.ts'
import { httpError } from './http.ts'
import { generateRebbeReply } from './rebbe.ts'

export type AccountRole = 'user' | 'tester' | 'admin'

type AccountRow = {
  id: string
  username: string
  phone: string
  password_hash: string
  role: AccountRole
  created_at: string
}

export type PublicAccount = {
  id: string
  username: string
  role: AccountRole
  createdAt: string
}

export type PublicTicket = {
  id: string
  accountId: string | null
  name: string
  subject: string
  body: string
  status: 'open' | 'in_progress' | 'closed'
  createdAt: string
}

function iso(value: unknown): string {
  return new Date(value as string).toISOString()
}

function publicAccount(account: AccountRow | null): PublicAccount | null {
  if (!account) return null
  return {
    id: account.id,
    username: account.username,
    role: account.role,
    createdAt: iso(account.created_at),
  }
}

function publicTicket(row: {
  id: string
  account_id: string | null
  name: string
  subject: string
  body: string
  status: 'open' | 'in_progress' | 'closed'
  created_at: string
}): PublicTicket {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    status: row.status,
    createdAt: iso(row.created_at),
  }
}

function isUniqueViolation(err: unknown): boolean {
  return String((err as { code?: string })?.code || '') === '23505'
}

async function isOwnerPhone(phone: string): Promise<boolean> {
  const configured = (await setting('owner_phone_digest')).trim().toLowerCase()
  const incoming = await phoneDigestHex(phone)
  return digestMatches(incoming, configured)
}

async function createSession(accountId: string): Promise<string> {
  const token = randomToken()
  const tokenHash = await sha256Hex(token)
  await query(
    'delete from guide.sessions where account_id = $1::uuid or expires_at < now()',
    [accountId],
  )
  await query(
    'insert into guide.sessions (token_hash, account_id, expires_at) values ($1, $2::uuid, now() + interval \'30 days\')',
    [tokenHash, accountId],
  )
  return token
}

export async function registerAccount(body: Record<string, unknown>) {
  const user = String(body.username || '').trim()
  const tel = normalizePhone(body.phone)
  const pass = String(body.password || '')
  if (user.length < 3) throw httpError('Username too short', 400)
  if (tel.length < 8) throw httpError('Enter a valid phone number', 400)
  if (pass.length < 6) throw httpError('Password must be at least 6 characters', 400)

  const role: AccountRole = (await isOwnerPhone(tel)) ? 'admin' : 'user'
  const passwordHash = await hashPassword(pass)

  try {
    const rows = await query<AccountRow>(
      'insert into guide.accounts (username, phone, password_hash, role) values ($1, $2, $3, $4) returning id, username, phone, password_hash, role, created_at',
      [user, tel, passwordHash, role],
    )
    const account = rows[0]
    const token = await createSession(account.id)
    return { token, account: publicAccount(account) }
  } catch (err) {
    if (isUniqueViolation(err)) {
      const detail = String(
        (err as { constraint_name?: string; constraint?: string }).constraint_name ||
          (err as { constraint?: string }).constraint ||
          '',
      )
      if (detail.includes('phone')) throw httpError('Phone number already registered', 409)
      throw httpError('Username already taken', 409)
    }
    throw err
  }
}

export async function loginAccount(body: Record<string, unknown>) {
  const pass = String(body.password || '')
  const user = String(body.username || '').trim()
  const tel = normalizePhone(body.phone)
  if (!pass) throw httpError('Wrong username/phone or password', 401)

  const rows = await query<AccountRow>(
    'select id, username, phone, password_hash, role, created_at from guide.accounts where ($1 <> \'\' and lower(username) = lower($1)) or ($2 <> \'\' and phone = $2) limit 1',
    [user, tel],
  )
  const account = rows[0]
  if (!account || !(await verifyPassword(pass, account.password_hash))) {
    throw httpError('Wrong username/phone or password', 401)
  }

  if ((await isOwnerPhone(account.phone)) && account.role !== 'admin') {
    const updated = await query<AccountRow>(
      'update guide.accounts set role = \'admin\' where id = $1::uuid returning id, username, phone, password_hash, role, created_at',
      [account.id],
    )
    Object.assign(account, updated[0])
  }

  const token = await createSession(account.id)
  return { token, account: publicAccount(account) }
}

export async function logoutAccount(token: string) {
  if (!token) return { ok: true }
  const tokenHash = await sha256Hex(token)
  await query('delete from guide.sessions where token_hash = $1', [tokenHash])
  return { ok: true }
}

export async function accountFromToken(token: string): Promise<PublicAccount | null> {
  if (!token) return null
  const tokenHash = await sha256Hex(token)
  const rows = await query<AccountRow>(
    'select a.id, a.username, a.phone, a.password_hash, a.role, a.created_at from guide.sessions s join guide.accounts a on a.id = s.account_id where s.token_hash = $1 and s.expires_at > now() limit 1',
    [tokenHash],
  )
  return publicAccount(rows[0] || null)
}

export async function requireRole(token: string, roles: AccountRole[]) {
  const account = await accountFromToken(token)
  if (!account) throw httpError('Please sign in', 401)
  if (!roles.includes(account.role)) throw httpError('You do not have access', 403)
  return account
}

export async function listUsers(token: string) {
  await requireRole(token, ['admin'])
  const rows = await query<AccountRow>(
    'select id, username, phone, password_hash, role, created_at from guide.accounts order by created_at asc',
  )
  return rows.map((row) => publicAccount(row))
}

export async function setUserRole(token: string, accountId: unknown, role: unknown) {
  await requireRole(token, ['admin'])
  if (!['user', 'tester', 'admin'].includes(String(role))) {
    throw httpError('Invalid role', 400)
  }
  const rows = await query<AccountRow>(
    'update guide.accounts set role = $1 where id = $2::uuid returning id, username, phone, password_hash, role, created_at',
    [String(role), String(accountId)],
  )
  if (!rows[0]) throw httpError('User not found', 404)
  return publicAccount(rows[0])
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

export async function handleAccountAction(
  action: string,
  body: Record<string, unknown>,
  token: string,
) {
  if (action === 'register') return registerAccount(body)
  if (action === 'login') return loginAccount(body)
  if (action === 'logout') return logoutAccount(token)
  if (action === 'me') return { account: await accountFromToken(token) }
  if (action === 'users') return { users: await listUsers(token) }
  if (action === 'setRole') {
    return { account: await setUserRole(token, body.accountId, body.role) }
  }
  if (action === 'createTicket') {
    return {
      ticket: await createTicket({
        token,
        name: body.name,
        phone: body.phone,
        subject: body.subject,
        body: body.body,
      }),
    }
  }
  if (action === 'tickets') return { tickets: await listTickets(token) }
  if (action === 'updateTicket') {
    return { ticket: await updateTicket(token, body.ticketId, body.status) }
  }
  if (action === 'trainingList') return { training: await listTraining(token) }
  if (action === 'trainingSave') return { training: await addTraining(token, body) }
  if (action === 'trainingChat') {
    await requireRole(token, ['admin', 'tester'])
    const lesson = await generateRebbeReply({
      messages: Array.isArray(body.messages) ? body.messages : [],
      gemaraRef: String(body.gemaraRef || 'Training desk'),
      hebrewLine: String(body.hebrewLine || ''),
      englishLine: String(body.englishLine || ''),
      lineIndex: 0,
      mode: 'ask',
      question: String(body.question || 'Practice reply.'),
      needWelcome: false,
    })
    return {
      reply: lesson.speech || lesson.explain || '',
      highlights: lesson.highlights || [],
    }
  }
  throw httpError('Unknown action', 400)
}
