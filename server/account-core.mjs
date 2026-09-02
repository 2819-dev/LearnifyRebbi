import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '.data')
const DATA_FILE = join(DATA_DIR, 'guide-store.json')

function defaultDb() {
  return {
    accounts: [],
    sessions: [],
    tickets: [],
    training: [],
  }
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(password), salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false
  const next = scryptSync(String(password), salt, 64)
  const prev = Buffer.from(hash, 'hex')
  if (prev.length !== next.length) return false
  return timingSafeEqual(prev, next)
}

function sessionToken() {
  return randomBytes(32).toString('hex')
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '')
}

function publicAccount(account) {
  if (!account) return null
  return {
    id: account.id,
    username: account.username,
    role: account.role,
    createdAt: account.createdAt,
  }
}

function publicTicket(ticket) {
  if (!ticket) return null
  return {
    id: ticket.id,
    accountId: ticket.accountId,
    name: ticket.name,
    subject: ticket.subject,
    body: ticket.body,
    status: ticket.status,
    createdAt: ticket.createdAt,
  }
}

function phoneDigits(phone) {
  return String(phone || '')
    .replace(/\D/g, '')
    .replace(/^1(?=\d{10}$)/, '')
    .slice(-10)
}

function phoneDigest(phone) {
  const digits = phoneDigits(phone)
  if (digits.length < 10) return null
  return createHash('sha256').update(`guide.owner.v1:${digits}`).digest()
}

function isOwnerPhone(phone) {
  const configured = process.env.GUIDE_OWNER_PHONE || ''
  if (!configured.trim()) return false
  const a = phoneDigest(phone)
  const b = phoneDigest(configured)
  if (!a || !b || a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function readDb() {
  // Prefer Netlify Blobs when available.
  try {
    const { getStore } = await import('@netlify/blobs')
    const store = getStore('guide-data')
    const data = await store.get('db', { type: 'json' })
    if (data && typeof data === 'object') return { ...defaultDb(), ...data, via: 'blobs' }
  } catch {
    // local / unavailable
  }

  if (!existsSync(DATA_FILE)) return { ...defaultDb(), via: 'file' }
  try {
    const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
    return { ...defaultDb(), ...raw, via: 'file' }
  } catch {
    return { ...defaultDb(), via: 'file' }
  }
}

async function writeDb(db) {
  const payload = {
    accounts: db.accounts || [],
    sessions: db.sessions || [],
    tickets: db.tickets || [],
    training: db.training || [],
  }

  try {
    const { getStore } = await import('@netlify/blobs')
    const store = getStore('guide-data')
    await store.setJSON('db', payload)
    return
  } catch {
    // fall through to file
  }

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2))
}

async function ensureBootstrapAdmin(db) {
  const raw =
    process.env.GUIDE_BOOTSTRAP_ADMIN ||
    'admin:+10000000000:GuideAdmin1'
  const [username, phone, password] = raw.split(':')
  if (!username || !phone || !password) return db
  const exists = db.accounts.some(
    (a) => a.username.toLowerCase() === username.toLowerCase(),
  )
  if (exists) return db
  db.accounts.push({
    id: createHash('sha256').update(`admin:${username}`).digest('hex').slice(0, 24),
    username,
    phone: normalizePhone(phone),
    passwordHash: hashPassword(password),
    role: 'admin',
    createdAt: new Date().toISOString(),
  })
  await writeDb(db)
  return db
}

async function promoteOwnerAccounts(db) {
  if (!process.env.GUIDE_OWNER_PHONE) return db
  let changed = false
  for (const account of db.accounts) {
    if (isOwnerPhone(account.phone) && account.role !== 'admin') {
      account.role = 'admin'
      changed = true
    }
  }
  if (changed) await writeDb(db)
  return db
}

export async function getDb() {
  const db = await readDb()
  await ensureBootstrapAdmin(db)
  return promoteOwnerAccounts(db)
}

export async function registerAccount({ username, phone, password }) {
  const db = await getDb()
  const user = String(username || '').trim()
  const tel = normalizePhone(phone)
  const pass = String(password || '')
  if (user.length < 3) throw Object.assign(new Error('Username too short'), { status: 400 })
  if (tel.length < 8) throw Object.assign(new Error('Enter a valid phone number'), { status: 400 })
  if (pass.length < 6) throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 })
  if (db.accounts.some((a) => a.username.toLowerCase() === user.toLowerCase())) {
    throw Object.assign(new Error('Username already taken'), { status: 409 })
  }
  if (db.accounts.some((a) => a.phone === tel)) {
    throw Object.assign(new Error('Phone number already registered'), { status: 409 })
  }
  const account = {
    id: randomBytes(12).toString('hex'),
    username: user,
    phone: tel,
    passwordHash: hashPassword(pass),
    role: isOwnerPhone(tel) ? 'admin' : 'user',
    createdAt: new Date().toISOString(),
  }
  db.accounts.push(account)
  const token = sessionToken()
  db.sessions.push({
    token,
    accountId: account.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  })
  await writeDb(db)
  return { token, account: publicAccount(account) }
}

export async function loginAccount({ username, phone, password }) {
  const db = await getDb()
  const pass = String(password || '')
  const user = String(username || '').trim().toLowerCase()
  const tel = normalizePhone(phone)
  const account = db.accounts.find(
    (a) =>
      (user && a.username.toLowerCase() === user) ||
      (tel && a.phone === tel),
  )
  if (!account || !verifyPassword(pass, account.passwordHash)) {
    throw Object.assign(new Error('Wrong username/phone or password'), { status: 401 })
  }
  if (isOwnerPhone(account.phone) && account.role !== 'admin') {
    account.role = 'admin'
  }
  const token = sessionToken()
  db.sessions = db.sessions.filter(
    (s) => s.accountId !== account.id && new Date(s.expiresAt) > new Date(),
  )
  db.sessions.push({
    token,
    accountId: account.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  })
  await writeDb(db)
  return { token, account: publicAccount(account) }
}

export async function logoutAccount(token) {
  const db = await getDb()
  db.sessions = db.sessions.filter((s) => s.token !== token)
  await writeDb(db)
  return { ok: true }
}

export async function accountFromToken(token) {
  if (!token) return null
  const db = await getDb()
  const session = db.sessions.find(
    (s) => s.token === token && new Date(s.expiresAt) > new Date(),
  )
  if (!session) return null
  const account = db.accounts.find((a) => a.id === session.accountId)
  return publicAccount(account)
}

export async function requireRole(token, roles) {
  const account = await accountFromToken(token)
  if (!account) throw Object.assign(new Error('Please sign in'), { status: 401 })
  if (!roles.includes(account.role)) {
    throw Object.assign(new Error('You do not have access'), { status: 403 })
  }
  return account
}

export async function listUsers(token) {
  await requireRole(token, ['admin'])
  const db = await getDb()
  return db.accounts.map(publicAccount)
}

export async function setUserRole(token, accountId, role) {
  await requireRole(token, ['admin'])
  if (!['user', 'tester', 'admin'].includes(role)) {
    throw Object.assign(new Error('Invalid role'), { status: 400 })
  }
  const db = await getDb()
  const account = db.accounts.find((a) => a.id === accountId)
  if (!account) throw Object.assign(new Error('User not found'), { status: 404 })
  account.role = role
  await writeDb(db)
  return publicAccount(account)
}

export async function createTicket({ token, name, phone, subject, body }) {
  const db = await getDb()
  const account = token ? await accountFromToken(token) : null
  const ticket = {
    id: randomBytes(10).toString('hex'),
    accountId: account?.id || null,
    name: String(name || account?.username || 'Guest').trim().slice(0, 80),
    phone: normalizePhone(phone || account?.phone || ''),
    subject: String(subject || '').trim().slice(0, 120) || 'Help',
    body: String(body || '').trim().slice(0, 4000),
    status: 'open',
    createdAt: new Date().toISOString(),
  }
  if (!ticket.body) throw Object.assign(new Error('Write a short message'), { status: 400 })
  db.tickets.unshift(ticket)
  await writeDb(db)
  return publicTicket(ticket)
}

export async function listTickets(token) {
  await requireRole(token, ['admin'])
  const db = await getDb()
  return db.tickets.map(publicTicket)
}

export async function updateTicket(token, ticketId, status) {
  await requireRole(token, ['admin'])
  if (!['open', 'in_progress', 'closed'].includes(status)) {
    throw Object.assign(new Error('Invalid status'), { status: 400 })
  }
  const db = await getDb()
  const ticket = db.tickets.find((t) => t.id === ticketId)
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { status: 404 })
  ticket.status = status
  await writeDb(db)
  return publicTicket(ticket)
}

export async function listTraining(token) {
  await requireRole(token, ['admin', 'tester'])
  const db = await getDb()
  return db.training
}

export async function addTraining(token, entry) {
  const account = await requireRole(token, ['admin', 'tester'])
  const db = await getDb()
  const row = {
    id: randomBytes(10).toString('hex'),
    testerId: account.id,
    testerUsername: account.username,
    prompt: String(entry.prompt || '').trim().slice(0, 2000),
    aiResponse: String(entry.aiResponse || '').trim().slice(0, 4000),
    correction: String(entry.correction || '').trim().slice(0, 4000),
    createdAt: new Date().toISOString(),
  }
  if (!row.prompt || !row.correction) {
    throw Object.assign(new Error('Prompt and correction are required'), { status: 400 })
  }
  db.training.unshift(row)
  db.training = db.training.slice(0, 200)
  await writeDb(db)
  return row
}

export async function trainingHintsForPrompt() {
  const db = await getDb()
  return (db.training || [])
    .slice(0, 12)
    .map(
      (t) =>
        `- When similar to "${t.prompt.slice(0, 120)}", prefer: ${t.correction.slice(0, 220)}`,
    )
    .join('\n')
}

export { publicAccount, publicTicket, normalizePhone }
