import { GUIDE_ANON_KEY, GUIDE_FUNCTIONS } from './guide-backend'

const TOKEN_KEY = 'guide.auth.token'

export type AccountRole = 'user' | 'tester' | 'admin' | 'rabbi'
export type RabbiStatus = 'none' | 'pending' | 'approved' | 'rejected'

export type Account = {
  id: string
  username: string
  role: AccountRole
  createdAt: string
  rabbiStatus: RabbiStatus
  rabbiDisplayName: string
  rabbiBio: string
}

export type SupportTicket = {
  id: string
  accountId: string | null
  name: string
  subject: string
  body: string
  status: 'open' | 'in_progress' | 'closed'
  createdAt: string
}

export type TrainingRow = {
  id: string
  testerId: string
  testerUsername: string
  prompt: string
  aiResponse: string
  correction: string
  createdAt: string
}

export type RabbiAnswers = {
  displayName: string
  experience: string
  ages: string
  availability: string
  approach: string
  why: string
}

export type RabbiProfile = {
  id: string
  username: string
  displayName: string
  bio: string
}

export type LearningRequest = {
  id: string
  studentId: string
  studentUsername: string
  rabbiId: string | null
  rabbiUsername: string | null
  message: string
  status: 'open' | 'claimed' | 'closed'
  createdAt: string
  updatedAt: string
}

export type RabbiWaitMessage = {
  id: string
  accountId: string | null
  name: string
  message: string
  status: 'open' | 'closed'
  createdAt: string
}

export type RabbiApplication = {
  id: string
  username: string
  displayName: string
  bio: string
  answers: Partial<RabbiAnswers>
  status: RabbiStatus
  createdAt: string
}

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

async function accountApi<T>(
  action: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const token = getToken()
  const res = await fetch(GUIDE_FUNCTIONS.account, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: GUIDE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, token, ...body }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data as T
}

export async function register(input: {
  username: string
  phone: string
  password: string
}) {
  const data = await accountApi<{ token: string; account: Account }>(
    'register',
    input,
  )
  setToken(data.token)
  return data.account
}

export async function registerRabbi(input: {
  username: string
  phone: string
  password: string
  answers: RabbiAnswers
}) {
  const data = await accountApi<{ token: string; account: Account }>(
    'registerRabbi',
    input,
  )
  setToken(data.token)
  return data.account
}

export async function applyAsRabbi(answers: RabbiAnswers) {
  const data = await accountApi<{ account: Account }>('applyAsRabbi', {
    answers,
  })
  return data.account
}

export async function login(input: {
  username?: string
  phone?: string
  password: string
}) {
  const data = await accountApi<{ token: string; account: Account }>(
    'login',
    input,
  )
  setToken(data.token)
  return data.account
}

export async function logout() {
  try {
    await accountApi('logout')
  } finally {
    setToken('')
  }
}

export async function fetchMe() {
  const data = await accountApi<{ account: Account | null }>('me')
  return data.account
}

export async function fetchUsers() {
  const data = await accountApi<{ users: Account[] }>('users')
  return data.users
}

export async function setRole(accountId: string, role: AccountRole) {
  const data = await accountApi<{ account: Account }>('setRole', {
    accountId,
    role,
  })
  return data.account
}

export async function fetchPendingRabbis() {
  const data = await accountApi<{ applications: RabbiApplication[] }>(
    'pendingRabbis',
  )
  return data.applications
}

export async function reviewRabbi(
  accountId: string,
  decision: 'approved' | 'rejected',
) {
  const data = await accountApi<{ account: Account }>('reviewRabbi', {
    accountId,
    decision,
  })
  return data.account
}

export async function fetchAvailableRabbis() {
  const data = await accountApi<{ rabbis: RabbiProfile[] }>('availableRabbis')
  return data.rabbis
}

export async function createLearningRequest(message: string) {
  const data = await accountApi<{ request: LearningRequest }>(
    'createLearningRequest',
    { message },
  )
  return data.request
}

export async function fetchMyLearningRequests() {
  const data = await accountApi<{ requests: LearningRequest[] }>(
    'myLearningRequests',
  )
  return data.requests
}

export async function fetchRabbiLearningRequests() {
  const data = await accountApi<{ requests: LearningRequest[] }>(
    'rabbiLearningRequests',
  )
  return data.requests
}

export async function claimLearningRequest(requestId: string) {
  const data = await accountApi<{ request: LearningRequest }>(
    'claimLearningRequest',
    { requestId },
  )
  return data.request
}

export async function closeLearningRequest(requestId: string) {
  const data = await accountApi<{ request: LearningRequest }>(
    'closeLearningRequest',
    { requestId },
  )
  return data.request
}

export async function createRabbiWaitMessage(input: {
  name?: string
  message: string
}) {
  const data = await accountApi<{ message: RabbiWaitMessage }>(
    'createRabbiMessage',
    input,
  )
  return data.message
}

export async function fetchRabbiWaitMessages() {
  const data = await accountApi<{ messages: RabbiWaitMessage[] }>(
    'rabbiMessages',
  )
  return data.messages
}

export async function updateRabbiWaitMessage(
  messageId: string,
  status: RabbiWaitMessage['status'],
) {
  const data = await accountApi<{ message: RabbiWaitMessage }>(
    'updateRabbiMessage',
    { messageId, status },
  )
  return data.message
}

export async function createTicket(input: {
  name?: string
  phone?: string
  subject: string
  body: string
}) {
  const data = await accountApi<{ ticket: SupportTicket }>('createTicket', input)
  return data.ticket
}

export async function fetchTickets() {
  const data = await accountApi<{ tickets: SupportTicket[] }>('tickets')
  return data.tickets
}

export async function updateTicketStatus(
  ticketId: string,
  status: SupportTicket['status'],
) {
  const data = await accountApi<{ ticket: SupportTicket }>('updateTicket', {
    ticketId,
    status,
  })
  return data.ticket
}

export async function fetchTraining() {
  const data = await accountApi<{ training: TrainingRow[] }>('trainingList')
  return data.training
}

export async function saveTraining(input: {
  prompt: string
  aiResponse: string
  correction: string
}) {
  const data = await accountApi<{ training: TrainingRow }>('trainingSave', input)
  return data.training
}

export async function trainingChat(question: string, history: { role: 'user' | 'model'; content: string }[] = []) {
  const data = await accountApi<{ reply: string }>('trainingChat', {
    question,
    messages: history,
  })
  return data.reply
}

export function isApprovedRabbi(account: Account | null | undefined) {
  return Boolean(
    account &&
      (account.role === 'rabbi' || account.role === 'admin') &&
      (account.role === 'admin' || account.rabbiStatus === 'approved'),
  )
}
