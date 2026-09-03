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
import type {
  AccountRole,
  AccountRow,
  PublicAccount,
} from './account-types.ts'
import {
  ACCOUNT_COLS,
  cleanAnswers,
  createSession,
  isOwnerPhone,
  isUniqueViolation,
  publicAccount,
} from './account-types.ts'

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
      `insert into guide.accounts (username, phone, password_hash, role) values ($1, $2, $3, $4) returning ${ACCOUNT_COLS}`,
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

export async function registerRabbiAccount(body: Record<string, unknown>) {
  const answers = cleanAnswers(body.answers || body)
  const displayName = String(answers.displayName || body.displayName || '').trim().slice(0, 80)
  const bio = String(answers.approach || body.bio || '').trim().slice(0, 800)
  if (!displayName) throw httpError('Enter the name students should use', 400)
  if (!answers.experience) throw httpError('Tell us about your Gemara experience', 400)
  if (!answers.ages) throw httpError('Which ages do you teach?', 400)
  if (!answers.availability) throw httpError('Share your availability', 400)
  if (!answers.why) throw httpError('Why do you want to teach on Guide?', 400)

  const user = String(body.username || '').trim()
  const tel = normalizePhone(body.phone)
  const pass = String(body.password || '')
  if (user.length < 3) throw httpError('Username too short', 400)
  if (tel.length < 8) throw httpError('Enter a valid phone number', 400)
  if (pass.length < 6) throw httpError('Password must be at least 6 characters', 400)
  if (await isOwnerPhone(tel)) {
    throw httpError('Use the regular account flow for the owner phone', 400)
  }

  const passwordHash = await hashPassword(pass)
  try {
    const rows = await query<AccountRow>(
      `insert into guide.accounts (username, phone, password_hash, role, rabbi_status, rabbi_display_name, rabbi_bio, rabbi_answers)
       values ($1, $2, $3, 'user', 'pending', $4, $5, $6::jsonb)
       returning ${ACCOUNT_COLS}`,
      [user, tel, passwordHash, displayName, bio, JSON.stringify(answers)],
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

export async function applyAsRabbi(token: string, body: Record<string, unknown>) {
  const account = await accountFromToken(token)
  if (!account) throw httpError('Please sign in', 401)
  if (account.role === 'rabbi' || account.rabbiStatus === 'approved') {
    throw httpError('You are already an approved rabbi', 400)
  }
  if (account.rabbiStatus === 'pending') {
    throw httpError('Your rabbi application is already pending review', 400)
  }

  const answers = cleanAnswers(body.answers || body)
  const displayName = String(answers.displayName || body.displayName || '').trim().slice(0, 80)
  const bio = String(answers.approach || body.bio || '').trim().slice(0, 800)
  if (!displayName) throw httpError('Enter the name students should use', 400)
  if (!answers.experience) throw httpError('Tell us about your Gemara experience', 400)
  if (!answers.ages) throw httpError('Which ages do you teach?', 400)
  if (!answers.availability) throw httpError('Share your availability', 400)
  if (!answers.why) throw httpError('Why do you want to teach on Guide?', 400)

  const rows = await query<AccountRow>(
    `update guide.accounts
     set rabbi_status = 'pending',
         rabbi_display_name = $2,
         rabbi_bio = $3,
         rabbi_answers = $4::jsonb
     where id = $1::uuid
     returning ${ACCOUNT_COLS}`,
    [account.id, displayName, bio, JSON.stringify(answers)],
  )
  return publicAccount(rows[0])
}

export async function loginAccount(body: Record<string, unknown>) {
  const pass = String(body.password || '')
  const user = String(body.username || '').trim()
  const tel = normalizePhone(body.phone)
  if (!pass) throw httpError('Wrong username/phone or password', 401)

  const rows = await query<AccountRow>(
    `select ${ACCOUNT_COLS} from guide.accounts where ($1 <> '' and lower(username) = lower($1)) or ($2 <> '' and phone = $2) limit 1`,
    [user, tel],
  )
  const account = rows[0]
  if (!account || !(await verifyPassword(pass, account.password_hash))) {
    throw httpError('Wrong username/phone or password', 401)
  }

  if ((await isOwnerPhone(account.phone)) && account.role !== 'admin') {
    const updated = await query<AccountRow>(
      `update guide.accounts set role = 'admin' where id = $1::uuid returning ${ACCOUNT_COLS}`,
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
    `select a.id, a.username, a.phone, a.password_hash, a.role, a.created_at, a.rabbi_status, a.rabbi_display_name, a.rabbi_bio, a.rabbi_answers
     from guide.sessions s
     join guide.accounts a on a.id = s.account_id
     where s.token_hash = $1 and s.expires_at > now()
     limit 1`,
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

export async function requireApprovedRabbi(token: string) {
  const account = await accountFromToken(token)
  if (!account) throw httpError('Please sign in', 401)
  if (account.role === 'admin') return account
  if (account.role !== 'rabbi' || account.rabbiStatus !== 'approved') {
    throw httpError('Rabbi access is not approved yet', 403)
  }
  return account
}

export async function listUsers(token: string) {
  await requireRole(token, ['admin'])
  const rows = await query<AccountRow>(
    `select ${ACCOUNT_COLS} from guide.accounts order by created_at asc`,
  )
  return rows.map((row) => publicAccount(row))
}

export async function setUserRole(token: string, accountId: unknown, role: unknown) {
  await requireRole(token, ['admin'])
  if (!['user', 'tester', 'admin', 'rabbi'].includes(String(role))) {
    throw httpError('Invalid role', 400)
  }
  const nextRole = String(role) as AccountRole
  const rows = await query<AccountRow>(
    `update guide.accounts
     set role = $1,
         rabbi_status = case
           when $1 = 'rabbi' then 'approved'
           when rabbi_status = 'approved' and $1 <> 'rabbi' then 'none'
           else rabbi_status
         end
     where id = $2::uuid
     returning ${ACCOUNT_COLS}`,
    [nextRole, String(accountId)],
  )
  if (!rows[0]) throw httpError('User not found', 404)
  return publicAccount(rows[0])
}

