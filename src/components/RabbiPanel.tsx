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

export function RabbiPanel({ account, onBack }: Props) {
  const [requests, setRequests] = useState<LearningRequest[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setBusy(true)
    setError(null)
    try {
      setRequests(await fetchRabbiLearningRequests())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load requests')
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
          <p className="panel-sub">
            Teaching desk · {account.rabbiDisplayName || account.username}
          </p>
        </div>
        <div className="panel-actions">
          <button type="button" onClick={() => void refresh()} disabled={busy}>
            Refresh
          </button>
        </div>
      </header>

      {error && <p className="bad">{error}</p>}

      <section className="panel-card">
        <h2>Student requests</h2>
        <p className="lede panel-lede">
          Accept a waiting request to begin learning with that student. Finish
          a request when you are done.
        </p>
        {requests.length === 0 && (
          <p className="soft">No student requests right now.</p>
        )}
        <ul className="ticket-list">
          {requests.map((r) => (
            <li key={r.id}>
              <div className="ticket-top">
                <strong>{r.studentUsername}</strong>
                <span className={`ticket-status ${r.status}`}>
                  {learningRequestStatusLabel(r.status)}
                </span>
              </div>
              <p>{r.message}</p>
              <p className="soft">{new Date(r.createdAt).toLocaleString()}</p>
              <div className="ticket-actions">
                {r.status === 'open' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const next = await claimLearningRequest(r.id)
                      setRequests((prev) =>
                        prev.map((row) => (row.id === next.id ? next : row)),
                      )
                    }}
                  >
                    Accept
                  </button>
                )}
                {r.status !== 'closed' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const next = await closeLearningRequest(r.id)
                      setRequests((prev) =>
                        prev.map((row) => (row.id === next.id ? next : row)),
                      )
                    }}
                  >
                    Finish
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
