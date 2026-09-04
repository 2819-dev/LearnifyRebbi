import { generateRebbeReply } from './rebbe.ts'
import { httpError } from './http.ts'
import {
  accountFromToken,
  applyAsRabbi,
  loginAccount,
  logoutAccount,
  registerAccount,
  registerRabbiAccount,
  requireRole,
  setUserRole,
  listUsers,
} from './account-core.ts'
import {
  claimLearningRequest,
  cancelLearningRequest,
  closeLearningRequest,
  createLearningRequest,
  listAvailableRabbis,
  listMyLearningRequests,
  listPendingRabbis,
  listRabbiLearningRequests,
  reviewRabbi,
  setAcceptingStudents,
} from './account-rabbi.ts'
import {
  addTraining,
  createRabbiWaitMessage,
  createTicket,
  listRabbiWaitMessages,
  listTickets,
  listTraining,
  updateRabbiWaitMessage,
  updateTicket,
} from './account-support.ts'

export async function handleAccountAction(
  action: string,
  body: Record<string, unknown>,
  token: string,
) {
  if (action === 'register') return registerAccount(body)
  if (action === 'registerRabbi') return registerRabbiAccount(body)
  if (action === 'applyAsRabbi') {
    return { account: await applyAsRabbi(token, body) }
  }
  if (action === 'login') return loginAccount(body)
  if (action === 'logout') return logoutAccount(token)
  if (action === 'me') return { account: await accountFromToken(token) }
  if (action === 'users') return { users: await listUsers(token) }
  if (action === 'setRole') {
    return { account: await setUserRole(token, body.accountId, body.role) }
  }
  if (action === 'pendingRabbis') {
    return { applications: await listPendingRabbis(token) }
  }
  if (action === 'reviewRabbi') {
    return {
      account: await reviewRabbi(token, body.accountId, body.decision),
    }
  }
  if (action === 'availableRabbis') {
    return { rabbis: await listAvailableRabbis() }
  }
  if (action === 'setAcceptingStudents') {
    return {
      account: await setAcceptingStudents(token, body.accepting),
    }
  }
  if (action === 'createLearningRequest') {
    return {
      request: await createLearningRequest(token, body.message),
    }
  }
  if (action === 'myLearningRequests') {
    return { requests: await listMyLearningRequests(token) }
  }
  if (action === 'rabbiLearningRequests') {
    return { requests: await listRabbiLearningRequests(token) }
  }
  if (action === 'claimLearningRequest') {
    return {
      request: await claimLearningRequest(token, body.requestId),
    }
  }
  if (action === 'closeLearningRequest') {
    return {
      request: await closeLearningRequest(token, body.requestId),
    }
  }
  if (action === 'cancelLearningRequest') {
    return {
      request: await cancelLearningRequest(token, body.requestId),
    }
  }
  if (action === 'createRabbiMessage') {
    return {
      message: await createRabbiWaitMessage({
        token,
        name: body.name,
        message: body.message,
      }),
    }
  }
  if (action === 'rabbiMessages') {
    return { messages: await listRabbiWaitMessages(token) }
  }
  if (action === 'updateRabbiMessage') {
    return {
      message: await updateRabbiWaitMessage(token, body.messageId, body.status),
    }
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
