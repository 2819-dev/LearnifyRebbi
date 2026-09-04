import { useEffect, useState } from 'react'
import {
  claimLearningRequest,
  closeLearningRequest,
  fetchRabbiLearningRequests,
  fetchRabbiWaitMessages,
  learningRequestStatusLabel,
  setAcceptingStudents,
  updateRabbiWaitMessage,
  type Account,
  type LearningRequest,
  type RabbiWaitMessage,
} from '../lib/account'
import { AppMark } from './AppMark'

type Props = {
  account: Account
  onBack: () => void
  onAccountChange?: (account: Account) => void
}

function formatContact(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return null
  return raw
}

export function RabbiPanel({ account, onBack, onAccountChange }: Props) {
  const [requests, setRequests] = useState<LearningRequest[]>([])
  const [waitMessages, setWaitMessages] = useState<RabbiWaitMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(account.acceptingStudents !== false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [nextRequests, nextWait] = await Promise.all([
        fetchRabbiLearningRequests(),
        fetchRabbiWaitMessages().catch(() => [] as RabbiWaitMessage[]),
      ])
      setRequests(nextRequests)
      setWaitMessages(nextWait.filter((m) => m.status === 'open'))
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
    const id = window.setInterval(() => {
      void refresh()
    }, 20000)
    return () => window.clearInterval(id)
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
          <button
            type="button"
            className="mark-back"
            onClick={onBack}
            aria-label="Back to home"
          >
            <AppMark />
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
        <h2>Availability</h2>
        <p className="lede panel-lede">
          When you are accepting students, learners can request to learn with
          you.
        </p>
        <label className="accepting-toggle">
          <input
            type="checkbox"
            checked={accepting}
            disabled={toggling}
            onChange={async (e) => {
              const next = e.target.checked
              setToggling(true)
              setError(null)
              try {
                const updated = await setAcceptingStudents(next)
                setAccepting(updated.acceptingStudents !== false)
                onAccountChange?.(updated)
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : 'Could not update availability.',
                )
              } finally {
                setToggling(false)
              }
            }}
          />
          <span>
            {accepting
              ? 'Accepting students right now'
              : 'Not accepting students'}
          </span>
        </label>
      </section>

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
                      disabled={busy || !accepting}
                      onClick={() => void runAction(r.id, 'claim')}
                    >
                      {busy ? 'Working…' : 'Accept'}
                    </button>
                  )}
                  {r.status !== 'closed' && r.status !== 'cancelled' && (
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

      <section className="panel-card">
        <h2>Waiting students</h2>
        <p className="lede panel-lede">
          Notes left when no Rebbeim were available. Open your desk if you can
          help.
        </p>
        {waitMessages.length === 0 ? (
          <p className="soft">No waiting notes right now.</p>
        ) : (
          <ul className="ticket-list">
            {waitMessages.map((m) => (
              <li key={m.id}>
                <div className="ticket-top">
                  <strong>{m.name}</strong>
                  <span className="ticket-status open">Waiting</span>
                </div>
                <p>{m.message}</p>
                <p className="soft">{new Date(m.createdAt).toLocaleString()}</p>
                <div className="ticket-actions">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await updateRabbiWaitMessage(m.id, 'closed')
                        setWaitMessages((prev) =>
                          prev.filter((row) => row.id !== m.id),
                        )
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : 'Could not update that note.',
                        )
                      }
                    }}
                  >
                    Mark seen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
