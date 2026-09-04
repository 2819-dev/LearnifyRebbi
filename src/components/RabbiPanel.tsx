import { useEffect, useState } from 'react'
import {
  claimLearningRequest,
  closeLearningRequest,
  fetchRabbiLearningRequests,
  learningRequestStatusLabel,
  type Account,
  type LearningRequest,
} from '../lib/account'
import { APP_NAME } from '../lib/brand'

type Props = {
  account: Account
  onBack: () => void
}

function formatContact(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return null
  return raw
}

export function RabbiPanel({ account, onBack }: Props) {
  const [requests, setRequests] = useState<LearningRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      setRequests(await fetchRabbiLearningRequests())
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load student requests. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function runAction(
    requestId: string,
    action: 'claim' | 'close',
  ) {
    setActionId(requestId)
    setError(null)
    try {
      const next =
        action === 'claim'
          ? await claimLearningRequest(requestId)
          : await closeLearningRequest(requestId)
      setRequests((prev) =>
        prev.map((row) => (row.id === next.id ? next : row)),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'That action did not work. Please try again.',
      )
      await refresh()
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="shell panel-shell">
      <header className="panel-bar">
        <div>
          <button type="button" className="linkish" onClick={onBack}>
            {APP_NAME}
          </button>
          <p className="panel-sub">
            Teaching desk · {account.rabbiDisplayName || account.username}
          </p>
        </div>
        <div className="panel-actions">
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>

      {error && <p className="bad">{error}</p>}

      <section className="panel-card">
        <h2>Student requests</h2>
        <p className="lede panel-lede">
          Accept a waiting request to get the student’s phone number. Reach out
          to arrange a time, then finish the request when you are done.
        </p>
        {loading && requests.length === 0 && (
          <p className="soft">Loading requests…</p>
        )}
        {!loading && requests.length === 0 && (
          <p className="soft">No student requests right now.</p>
        )}
        <ul className="ticket-list">
          {requests.map((r) => {
            const contact = formatContact(r.studentContact)
            const busy = actionId === r.id
            return (
              <li key={r.id}>
                <div className="ticket-top">
                  <strong>{r.studentUsername}</strong>
                  <span className={`ticket-status ${r.status}`}>
                    {learningRequestStatusLabel(r.status)}
                  </span>
                </div>
                <p>{r.message}</p>
                {contact && (
                  <p className="match-contact">
                    Student phone:{' '}
                    <a href={`tel:${contact}`}>{contact}</a>
                  </p>
                )}
                {r.status === 'claimed' && contact && (
                  <p className="soft">
                    Call or text them to set up learning. They can also see your
                    phone number.
                  </p>
                )}
                <p className="soft">{new Date(r.createdAt).toLocaleString()}</p>
                <div className="ticket-actions">
                  {r.status === 'open' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(r.id, 'claim')}
                    >
                      {busy ? 'Working…' : 'Accept'}
                    </button>
                  )}
                  {r.status !== 'closed' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(r.id, 'close')}
                    >
                      {busy ? 'Working…' : 'Finish'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
