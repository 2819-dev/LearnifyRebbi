import { useEffect, useState } from 'react'
import {
  fetchTickets,
  fetchUsers,
  setRole,
  updateTicketStatus,
  type Account,
  type AccountRole,
  type SupportTicket,
} from '../lib/account'
import { APP_NAME } from '../lib/brand'

type Props = {
  account: Account
  onBack: () => void
  onOpenTesting: () => void
}

export function AdminPanel({ account, onBack, onOpenTesting }: Props) {
  const [tab, setTab] = useState<'tickets' | 'access'>('tickets')
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [users, setUsers] = useState<Account[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setBusy(true)
    setError(null)
    try {
      const [t, u] = await Promise.all([fetchTickets(), fetchUsers()])
      setTickets(t)
      setUsers(u)
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
                  {t.name} · {t.phone || 'no phone'} ·{' '}
                  {new Date(t.createdAt).toLocaleString()}
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

      {tab === 'access' && (
        <section className="panel-card">
          <h2>Who can access what</h2>
          <p className="lede panel-lede">
            Admin = tickets + access. Tester = AI training panel only.
          </p>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u.id}>
                <div>
                  <strong>{u.username}</strong>
                  <p className="soft">{u.phone}</p>
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
