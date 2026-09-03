import { useEffect, useState } from 'react'
import {
  fetchPendingRabbis,
  fetchRabbiWaitMessages,
  fetchTickets,
  fetchUsers,
  reviewRabbi,
  setRole,
  ticketStatusLabel,
  updateRabbiWaitMessage,
  updateTicketStatus,
  rabbiStatusLabel,
  roleLabel,
  type Account,
  type AccountRole,
  type RabbiApplication,
  type RabbiWaitMessage,
  type SupportTicket,
} from '../lib/account'
import { APP_NAME } from '../lib/brand'

type Props = {
  account: Account
  onBack: () => void
  onOpenTesting: () => void
}

export function AdminPanel({ account, onBack, onOpenTesting }: Props) {
  const [tab, setTab] = useState<'tickets' | 'rabbis' | 'messages' | 'access'>(
    'tickets',
  )
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [users, setUsers] = useState<Account[]>([])
  const [applications, setApplications] = useState<RabbiApplication[]>([])
  const [messages, setMessages] = useState<RabbiWaitMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setBusy(true)
    setError(null)
    try {
      const [t, u, apps, msgs] = await Promise.all([
        fetchTickets(),
        fetchUsers(),
        fetchPendingRabbis(),
        fetchRabbiWaitMessages(),
      ])
      setTickets(t)
      setUsers(u)
      setApplications(apps)
      setMessages(msgs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load owner tools')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <div className="shell panel-shell">
      <header className="panel-bar">
        <div>
          <button type="button" className="linkish" onClick={onBack}>
            {APP_NAME}
          </button>
          <p className="panel-sub">Owner tools · {account.username}</p>
        </div>
        <div className="panel-actions">
          <button type="button" onClick={onOpenTesting}>
            Coaching desk
          </button>
          <button type="button" onClick={() => void refresh()} disabled={busy}>
            Refresh
          </button>
        </div>
      </header>

      <div className="panel-tabs">
        <button
          type="button"
          className={tab === 'tickets' ? 'on' : ''}
          onClick={() => setTab('tickets')}
        >
          Support
        </button>
        <button
          type="button"
          className={tab === 'rabbis' ? 'on' : ''}
          onClick={() => setTab('rabbis')}
        >
          Rebbi applications
        </button>
        <button
          type="button"
          className={tab === 'messages' ? 'on' : ''}
          onClick={() => setTab('messages')}
        >
          Waitlist
        </button>
        <button
          type="button"
          className={tab === 'access' ? 'on' : ''}
          onClick={() => setTab('access')}
        >
          People
        </button>
      </div>

      {error && <p className="bad">{error}</p>}

      {tab === 'tickets' && (
        <section className="panel-card">
          <h2>Support messages</h2>
          {tickets.length === 0 && <p className="soft">No messages yet.</p>}
          <ul className="ticket-list">
            {tickets.map((t) => (
              <li key={t.id}>
                <div className="ticket-top">
                  <strong>{t.subject}</strong>
                  <span className={`ticket-status ${t.status}`}>
                    {ticketStatusLabel(t.status)}
                  </span>
                </div>
                <p>{t.body}</p>
                <p className="soft">
                  {t.name} · {new Date(t.createdAt).toLocaleString()}
                </p>
                <div className="ticket-actions">
                  {(
                    [
                      ['open', 'New'],
                      ['in_progress', 'In progress'],
                      ['closed', 'Resolved'],
                    ] as const
                  ).map(([status, label]) => (
                    <button
                      key={status}
                      type="button"
                      disabled={t.status === status}
                      onClick={async () => {
                        const next = await updateTicketStatus(t.id, status)
                        setTickets((prev) =>
                          prev.map((row) => (row.id === next.id ? next : row)),
                        )
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'rabbis' && (
        <section className="panel-card">
          <h2>Rebbi applications</h2>
          <p className="lede panel-lede">
            Welcome a teacher to start meeting students, or decline gently and
            leave them as a learner.
          </p>
          {applications.length === 0 && (
            <p className="soft">No applications waiting.</p>
          )}
          <ul className="ticket-list">
            {applications.map((app) => (
              <li key={app.id}>
                <div className="ticket-top">
                  <strong>{app.displayName || app.username}</strong>
                  <span className="ticket-status open">
                    {rabbiStatusLabel(app.status) || app.status}
                  </span>
                </div>
                <p className="soft">{app.username}</p>
                {app.answers.experience && (
                  <p>
                    <strong>Experience:</strong> {app.answers.experience}
                  </p>
                )}
                {app.answers.ages && (
                  <p>
                    <strong>Ages:</strong> {app.answers.ages}
                  </p>
                )}
                {app.answers.availability && (
                  <p>
                    <strong>Availability:</strong> {app.answers.availability}
                  </p>
                )}
                {app.answers.approach && (
                  <p>
                    <strong>Approach:</strong> {app.answers.approach}
                  </p>
                )}
                {app.answers.why && (
                  <p>
                    <strong>Why Guide:</strong> {app.answers.why}
                  </p>
                )}
                <div className="ticket-actions">
                  <button
                    type="button"
                    onClick={async () => {
                      await reviewRabbi(app.id, 'approved')
                      setApplications((prev) =>
                        prev.filter((row) => row.id !== app.id),
                      )
                      const nextUsers = await fetchUsers()
                      setUsers(nextUsers)
                    }}
                  >
                    Welcome
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await reviewRabbi(app.id, 'rejected')
                      setApplications((prev) =>
                        prev.filter((row) => row.id !== app.id),
                      )
                    }}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'messages' && (
        <section className="panel-card">
          <h2>Messages for Rebbeim</h2>
          <p className="lede panel-lede">
            Notes from learners when no Rebbeim were free to teach.
          </p>
          {messages.length === 0 && <p className="soft">No waitlist notes.</p>}
          <ul className="ticket-list">
            {messages.map((m) => (
              <li key={m.id}>
                <div className="ticket-top">
                  <strong>{m.name}</strong>
                  <span className={`ticket-status ${m.status}`}>
                    {m.status === 'open' ? 'New' : 'Resolved'}
                  </span>
                </div>
                <p>{m.message}</p>
                <p className="soft">{new Date(m.createdAt).toLocaleString()}</p>
                <div className="ticket-actions">
                  {(
                    [
                      ['open', 'New'],
                      ['closed', 'Resolved'],
                    ] as const
                  ).map(([status, label]) => (
                    <button
                      key={status}
                      type="button"
                      disabled={m.status === status}
                      onClick={async () => {
                        const next = await updateRabbiWaitMessage(m.id, status)
                        setMessages((prev) =>
                          prev.map((row) => (row.id === next.id ? next : row)),
                        )
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'access' && (
        <section className="panel-card">
          <h2>People</h2>
          <p className="lede panel-lede">
            Owners manage Guide. Coaches improve the AI Rebbi. Rebbeim meet
            students. Everyone else is a learner.
          </p>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u.id}>
                <div>
                  <strong>{u.username}</strong>
                  <p className="soft">
                    {roleLabel(u.role)}
                    {u.rabbiStatus && u.rabbiStatus !== 'none'
                      ? ` · ${rabbiStatusLabel(u.rabbiStatus)}`
                      : ''}
                  </p>
                </div>
                <select
                  value={u.role}
                  disabled={u.id === account.id}
                  onChange={async (e) => {
                    const role = e.target.value as AccountRole
                    const next = await setRole(u.id, role)
                    setUsers((prev) =>
                      prev.map((row) => (row.id === next.id ? next : row)),
                    )
                  }}
                >
                  <option value="user">Student</option>
                  <option value="tester">Coach</option>
                  <option value="rabbi">Rebbi</option>
                  <option value="admin">Owner</option>
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
