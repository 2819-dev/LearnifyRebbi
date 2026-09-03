import { useEffect, useState } from 'react'
import {
  fetchPendingRabbis,
  fetchRabbiWaitMessages,
  fetchTickets,
  fetchUsers,
  reviewRabbi,
  setRole,
  updateRabbiWaitMessage,
  updateTicketStatus,
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
      setError(err instanceof Error ? err.message : 'Could not load admin data')
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
          <p className="panel-sub">Admin · {account.username}</p>
        </div>
        <div className="panel-actions">
          <button type="button" onClick={onOpenTesting}>
            Testing panel
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
          Support tickets
        </button>
        <button
          type="button"
          className={tab === 'rabbis' ? 'on' : ''}
          onClick={() => setTab('rabbis')}
        >
          Rebbi approvals
        </button>
        <button
          type="button"
          className={tab === 'messages' ? 'on' : ''}
          onClick={() => setTab('messages')}
        >
          Rebbi waitlist
        </button>
        <button
          type="button"
          className={tab === 'access' ? 'on' : ''}
          onClick={() => setTab('access')}
        >
          Access
        </button>
      </div>

      {error && <p className="bad">{error}</p>}

      {tab === 'tickets' && (
        <section className="panel-card">
          <h2>Support tickets</h2>
          {tickets.length === 0 && <p className="soft">No tickets yet.</p>}
          <ul className="ticket-list">
            {tickets.map((t) => (
              <li key={t.id}>
                <div className="ticket-top">
                  <strong>{t.subject}</strong>
                  <span className={`ticket-status ${t.status}`}>{t.status}</span>
                </div>
                <p>{t.body}</p>
                <p className="soft">
                  {t.name} · {new Date(t.createdAt).toLocaleString()}
                </p>
                <div className="ticket-actions">
                  {(['open', 'in_progress', 'closed'] as const).map((status) => (
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
                      {status}
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
          <h2>Pending Rebbi applications</h2>
          <p className="lede panel-lede">
            Approve to grant the Rebbi panel. Reject keeps them as a student.
          </p>
          {applications.length === 0 && (
            <p className="soft">No pending applications.</p>
          )}
          <ul className="ticket-list">
            {applications.map((app) => (
              <li key={app.id}>
                <div className="ticket-top">
                  <strong>{app.displayName || app.username}</strong>
                  <span className="ticket-status open">{app.status}</span>
                </div>
                <p className="soft">@{app.username}</p>
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
                    Approve
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
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'messages' && (
        <section className="panel-card">
          <h2>Messages for rebbeim</h2>
          <p className="lede panel-lede">
            Left by students when no approved rebbeim were available.
          </p>
          {messages.length === 0 && <p className="soft">No waitlist messages.</p>}
          <ul className="ticket-list">
            {messages.map((m) => (
              <li key={m.id}>
                <div className="ticket-top">
                  <strong>{m.name}</strong>
                  <span className={`ticket-status ${m.status}`}>{m.status}</span>
                </div>
                <p>{m.message}</p>
                <p className="soft">{new Date(m.createdAt).toLocaleString()}</p>
                <div className="ticket-actions">
                  {(['open', 'closed'] as const).map((status) => (
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
                      {status}
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
          <h2>Who can access what</h2>
          <p className="lede panel-lede">
            Admin = console. Tester = AI training. Rebbi = student request panel.
          </p>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u.id}>
                <div>
                  <strong>{u.username}</strong>
                  <p className="soft">
                    {u.role}
                    {u.rabbiStatus && u.rabbiStatus !== 'none'
                      ? ` · Rebbi ${u.rabbiStatus}`
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
                  <option value="tester">Tester</option>
                  <option value="rabbi">Rebbi</option>
                  <option value="admin">Admin</option>
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
