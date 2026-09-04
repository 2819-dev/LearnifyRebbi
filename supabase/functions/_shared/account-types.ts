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

export type AccountRole = 'user' | 'tester' | 'admin' | 'rabbi'
export type RabbiStatus = 'none' | 'pending' | 'approved' | 'rejected'

export type AccountRow = {
  id: string
  username: string
  phone: string
  password_hash: string
  role: AccountRole
  created_at: string
  rabbi_status?: RabbiStatus
  rabbi_display_name?: string
  rabbi_bio?: string
  rabbi_answers?: Record<string, unknown>
  accepting_students?: boolean
}

export type PublicAccount = {
  id: string
  username: string
  role: AccountRole
  createdAt: string
  rabbiStatus: RabbiStatus
  rabbiDisplayName: string
  rabbiBio: string
  acceptingStudents: boolean
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

export type PublicRabbiProfile = {
  id: string
  username: string
  displayName: string
  bio: string
}

export type PublicLearningRequest = {
  id: string
  studentId: string
  studentUsername: string
  studentContact: string | null
  rabbiId: string | null
  rabbiUsername: string | null
  rabbiDisplayName: string | null
  rebbiContact: string | null
  message: string
  status: 'open' | 'claimed' | 'closed' | 'cancelled'
  createdAt: string
  updatedAt: string
}

export type PublicRabbiMessage = {
  id: string
  accountId: string | null
  name: string
  message: string
  status: 'open' | 'closed'
  createdAt: string
}

export type PublicRabbiApplication = {
  id: string
  username: string
  displayName: string
  bio: string
  answers: Record<string, string>
  status: RabbiStatus
  createdAt: string
}

export const ACCOUNT_COLS =
  'id, username, phone, password_hash, role, created_at, rabbi_status, rabbi_display_name, rabbi_bio, rabbi_answers, accepting_students'

export function iso(value: unknown): string {
  return new Date(value as string).toISOString()
}

export function rabbiStatusOf(account: AccountRow): RabbiStatus {
  const status = String(account.rabbi_status || 'none')
  if (status === 'pending' || status === 'approved' || status === 'rejected') {
    return status
  }
  return 'none'
}

export function publicAccount(account: AccountRow | null): PublicAccount | null {
  if (!account) return null
  return {
    id: account.id,
    username: account.username,
    role: account.role,
    createdAt: iso(account.created_at),
    rabbiStatus: rabbiStatusOf(account),
    rabbiDisplayName: String(account.rabbi_display_name || ''),
    rabbiBio: String(account.rabbi_bio || ''),
    acceptingStudents: account.accepting_students !== false,
  }
}

export function publicTicket(row: {
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

export function publicLearningRequest(row: {
  id: string
  student_id: string
  student_username?: string
  student_contact?: string | null
  rabbi_id: string | null
  rabbi_username?: string | null
  rabbi_display_name?: string | null
  rebbi_contact?: string | null
  message: string
  status: 'open' | 'claimed' | 'closed' | 'cancelled'
  created_at: string
  updated_at: string
}): PublicLearningRequest {
  return {
    id: row.id,
    studentId: row.student_id,
    studentUsername: String(row.student_username || ''),
    studentContact: row.student_contact ? String(row.student_contact) : null,
    rabbiId: row.rabbi_id,
    rabbiUsername: row.rabbi_username ? String(row.rabbi_username) : null,
    rabbiDisplayName: row.rabbi_display_name
      ? String(row.rabbi_display_name)
      : null,
    rebbiContact: row.rebbi_contact ? String(row.rebbi_contact) : null,
    message: row.message,
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

export function publicRabbiMessage(row: {
  id: string
  account_id: string | null
  name: string
  message: string
  status: 'open' | 'closed'
  created_at: string
}): PublicRabbiMessage {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    message: row.message,
    status: row.status,
    createdAt: iso(row.created_at),
  }
}

export function cleanAnswers(raw: unknown): Record<string, string> {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const out: Record<string, string> = {}
  for (const key of [
    'displayName',
    'experience',
    'ages',
    'availability',
    'approach',
    'why',
  ]) {
    const value = String(src[key] || '').trim().slice(0, 800)
    if (value) out[key] = value
  }
  return out
}

export function isUniqueViolation(err: unknown): boolean {
  return String((err as { code?: string })?.code || '') === '23505'
}

export async function isOwnerPhone(phone: string): Promise<boolean> {
  const configured = (await setting('owner_phone_digest')).trim().toLowerCase()
  const incoming = await phoneDigestHex(phone)
  return digestMatches(incoming, configured)
}

export async function createSession(accountId: string): Promise<string> {
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

