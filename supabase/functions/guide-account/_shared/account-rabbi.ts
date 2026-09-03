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

export async function listPendingRabbis(token: string) {
  await requireRole(token, ['admin'])
  const rows = await query<AccountRow>(
    `select ${ACCOUNT_COLS} from guide.accounts where rabbi_status = 'pending' order by created_at asc`,
  )
  return rows.map((row): PublicRabbiApplication => ({
    id: row.id,
    username: row.username,
    displayName: String(row.rabbi_display_name || ''),
    bio: String(row.rabbi_bio || ''),
    answers: cleanAnswers(row.rabbi_answers || {}),
    status: rabbiStatusOf(row),
    createdAt: iso(row.created_at),
  }))
}

export async function reviewRabbi(
  token: string,
  accountId: unknown,
  decision: unknown,
) {
  await requireRole(token, ['admin'])
  const next = String(decision || '')
  if (next !== 'approved' && next !== 'rejected') {
    throw httpError('Decision must be approved or rejected', 400)
  }
  const rows = await query<AccountRow>(
    `update guide.accounts
     set rabbi_status = $1,
         role = case when $1 = 'approved' then 'rabbi' else case when role = 'rabbi' then 'user' else role end end
     where id = $2::uuid and rabbi_status = 'pending'
     returning ${ACCOUNT_COLS}`,
    [next, String(accountId)],
  )
  if (!rows[0]) throw httpError('Pending Rebbi application not found', 404)
  return publicAccount(rows[0])
}

export async function listAvailableRabbis() {
  const rows = await query<{
    id: string
    username: string
    rabbi_display_name: string
    rabbi_bio: string
  }>(
    `select id, username, rabbi_display_name, rabbi_bio
     from guide.accounts
     where role = 'rabbi' and rabbi_status = 'approved'
     order by lower(coalesce(nullif(rabbi_display_name, ''), username)) asc`,
  )
  return rows.map(
    (row): PublicRabbiProfile => ({
      id: row.id,
      username: row.username,
      displayName: String(row.rabbi_display_name || row.username),
      bio: String(row.rabbi_bio || ''),
    }),
  )
}

export async function createLearningRequest(token: string, messageRaw: unknown) {
  const account = await accountFromToken(token)
  if (!account) throw httpError('Please sign in to request a Rebbi', 401)
  if (account.role === 'rabbi' && account.rabbiStatus === 'approved') {
    throw httpError('Rebbeim cannot request learning from other rebbeim here', 400)
  }

  const available = await listAvailableRabbis()
  if (available.length === 0) {
    throw httpError('No rebbeim are available', 409)
  }

  const message = String(messageRaw || '').trim().slice(0, 2000)
  if (message.length < 3) throw httpError('Write a short note for the Rebbi', 400)

  const rows = await query(
    `insert into guide.learning_requests (student_id, message, status)
     values ($1::uuid, $2, 'open')
     returning id, student_id, rabbi_id, message, status, created_at, updated_at`,
    [account.id, message],
  )
  return publicLearningRequest({
    ...(rows[0] as {
      id: string
      student_id: string
      rabbi_id: string | null
      message: string
      status: 'open' | 'claimed' | 'closed'
      created_at: string
      updated_at: string
    }),
    student_username: account.username,
    rabbi_username: null,
  })
}

export async function listMyLearningRequests(token: string) {
  const account = await accountFromToken(token)
  if (!account) throw httpError('Please sign in', 401)
  const rows = await query(
    `select r.id, r.student_id, s.username as student_username, r.rabbi_id,
            a.username as rabbi_username, r.message, r.status, r.created_at, r.updated_at
     from guide.learning_requests r
     join guide.accounts s on s.id = r.student_id
     left join guide.accounts a on a.id = r.rabbi_id
     where r.student_id = $1::uuid
     order by r.created_at desc
     limit 50`,
    [account.id],
  )
  return (rows as Parameters<typeof publicLearningRequest>[0][]).map(publicLearningRequest)
}

export async function listRabbiLearningRequests(token: string) {
  const account = await requireApprovedRabbi(token)
  const rows = await query(
    `select r.id, r.student_id, s.username as student_username, r.rabbi_id,
            a.username as rabbi_username, r.message, r.status, r.created_at, r.updated_at
     from guide.learning_requests r
     join guide.accounts s on s.id = r.student_id
     left join guide.accounts a on a.id = r.rabbi_id
     where r.status = 'open' or r.rabbi_id = $1::uuid
     order by
       case r.status when 'open' then 0 when 'claimed' then 1 else 2 end,
       r.created_at desc
     limit 100`,
    [account.id],
  )
  return (rows as Parameters<typeof publicLearningRequest>[0][]).map(publicLearningRequest)
}

export async function claimLearningRequest(token: string, requestId: unknown) {
  const account = await requireApprovedRabbi(token)
  const rows = await query(
    `update guide.learning_requests
     set rabbi_id = $1::uuid, status = 'claimed', updated_at = now()
     where id = $2::uuid and status = 'open' and rabbi_id is null
     returning id, student_id, rabbi_id, message, status, created_at, updated_at`,
    [account.id, String(requestId)],
  )
  if (!rows[0]) throw httpError('Request is no longer available', 409)
  const student = await query<{ username: string }>(
    'select username from guide.accounts where id = $1::uuid limit 1',
    [(rows[0] as { student_id: string }).student_id],
  )
  return publicLearningRequest({
    ...(rows[0] as {
      id: string
      student_id: string
      rabbi_id: string | null
      message: string
      status: 'open' | 'claimed' | 'closed'
      created_at: string
      updated_at: string
    }),
    student_username: student[0]?.username || '',
    rabbi_username: account.username,
  })
}

export async function closeLearningRequest(token: string, requestId: unknown) {
  const account = await requireApprovedRabbi(token)
  const rows = await query(
    `update guide.learning_requests
     set status = 'closed', updated_at = now()
     where id = $1::uuid and (rabbi_id = $2::uuid or ($3 and status in ('open', 'claimed')))
     returning id, student_id, rabbi_id, message, status, created_at, updated_at`,
    [String(requestId), account.id, account.role === 'admin'],
  )
  if (!rows[0]) throw httpError('Request not found', 404)
  const meta = await query<{ student_username: string; rabbi_username: string | null }>(
    `select s.username as student_username, a.username as rabbi_username
     from guide.learning_requests r
     join guide.accounts s on s.id = r.student_id
     left join guide.accounts a on a.id = r.rabbi_id
     where r.id = $1::uuid`,
    [String(requestId)],
  )
  return publicLearningRequest({
    ...(rows[0] as {
      id: string
      student_id: string
      rabbi_id: string | null
      message: string
      status: 'open' | 'claimed' | 'closed'
      created_at: string
      updated_at: string
    }),
    student_username: meta[0]?.student_username || '',
    rabbi_username: meta[0]?.rabbi_username || null,
  })
}

