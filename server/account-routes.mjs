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
  requireRole,
  setUserRole,
  updateTicket,
} from './account-core.mjs'
import { generateRebbeReply } from './rebbe-core.mjs'

function tokenFrom(c, body = {}) {
  const header = c.req.header('authorization') || ''
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return body.token || ''
}

export function mountAccountRoutes(app) {
  app.post('/api/account', async (c) => {
    let body = {}
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }
    const action = body.action || ''
    try {
      if (action === 'register') return c.json(await registerAccount(body))
      if (action === 'login') return c.json(await loginAccount(body))
      if (action === 'logout') {
        await logoutAccount(tokenFrom(c, body))
        return c.json({ ok: true })
      }
      if (action === 'me') {
        return c.json({ account: await accountFromToken(tokenFrom(c, body)) })
      }
      if (action === 'users') {
        return c.json({ users: await listUsers(tokenFrom(c, body)) })
      }
      if (action === 'setRole') {
        return c.json({
          account: await setUserRole(
            tokenFrom(c, body),
            body.accountId,
            body.role,
          ),
        })
      }
      if (action === 'createTicket') {
        return c.json({
          ticket: await createTicket({
            token: tokenFrom(c, body),
            name: body.name,
            phone: body.phone,
            subject: body.subject,
            body: body.body,
          }),
        })
      }
      if (action === 'tickets') {
        return c.json({ tickets: await listTickets(tokenFrom(c, body)) })
      }
      if (action === 'updateTicket') {
        return c.json({
          ticket: await updateTicket(
            tokenFrom(c, body),
            body.ticketId,
            body.status,
          ),
        })
      }
      if (action === 'trainingList') {
        return c.json({ training: await listTraining(tokenFrom(c, body)) })
      }
      if (action === 'trainingSave') {
        return c.json({
          training: await addTraining(tokenFrom(c, body), body),
        })
      }
      if (action === 'trainingChat') {
        await requireRole(tokenFrom(c, body), ['admin', 'tester'])
        const lesson = await generateRebbeReply({
          messages: body.messages || [],
          gemaraRef: body.gemaraRef || 'Training desk',
          hebrewLine: body.hebrewLine || '',
          englishLine: body.englishLine || '',
          lineIndex: 0,
          mode: 'ask',
          question: body.question || 'Practice reply.',
          needWelcome: false,
        })
        return c.json({
          reply: lesson.speech || lesson.explain || '',
          highlights: lesson.highlights || [],
        })
      }
      return c.json({ error: 'Unknown action' }, 400)
    } catch (err) {
      console.error(err)
      return c.json({ error: err?.message || 'Request failed' }, err?.status || 500)
    }
  })

  app.get('/api/account', async (c) => {
    try {
      const action = c.req.query('action') || 'me'
      const header = c.req.header('authorization') || ''
      const token = header.toLowerCase().startsWith('bearer ')
        ? header.slice(7).trim()
        : c.req.query('token') || ''
      if (action === 'me') {
        return c.json({ account: await accountFromToken(token) })
      }
      if (action === 'users') return c.json({ users: await listUsers(token) })
      if (action === 'tickets') return c.json({ tickets: await listTickets(token) })
      if (action === 'trainingList') {
        return c.json({ training: await listTraining(token) })
      }
      return c.json({ error: 'Unknown action' }, 400)
    } catch (err) {
      return c.json({ error: err?.message || 'Request failed' }, err?.status || 500)
    }
  })
}
