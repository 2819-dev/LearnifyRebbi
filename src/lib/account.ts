const TOKEN_KEY = 'guide.auth.token'

export type AccountRole = 'user' | 'tester' | 'admin'

export type Account = {
  id: string
  username: string
  phone: string
  role: AccountRole
  createdAt: string
}

export type SupportTicket = {
  id: string
  accountId: string | null
  name: string
  phone: string
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
  const res = await fetch('/api/account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
