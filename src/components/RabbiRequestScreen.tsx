import { useEffect, useState } from 'react'
import {
  createLearningRequest,
  createRabbiWaitMessage,
  fetchAvailableRabbis,
  fetchMyLearningRequests,
  type Account,
  type LearningRequest,
  type RabbiProfile,
} from '../lib/account'
import { APP_NAME } from '../lib/brand'

type Props = {
  account: Account
  onLearnWithGuide: () => void
  onNeedSignIn?: () => void
  onBack: () => void
}

export function RabbiRequestScreen({
  account,
  onLearnWithGuide,
  onBack,
}: Props) {
  const [rabbis, setRabbis] = useState<RabbiProfile[] | null>(null)
  const [requests, setRequests] = useState<LearningRequest[]>([])
  const [message, setMessage] = useState(
    'I would like to learn Hashavas Aveidah with a real rabbi.',
  )
  const [waitName, setWaitName] = useState(account.username)
  const [waitMessage, setWaitMessage] = useState(
    'Please let me know when a rabbi is available to learn with.',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function refresh() {
    setBusy(true)
    setError(null)
    try {
      const [list, mine] = await Promise.all([
        fetchAvailableRabbis(),
        fetchMyLearningRequests(),
      ])
      setRabbis(list)
      setRequests(mine)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load rabbis')
      setRabbis([])
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const available = (rabbis || []).length > 0

  return (
    <div className="shell home-shell">
      <main className="home auth-home">
        <button type="button" className="linkish tiny" onClick={onBack}>
          ← Back to {APP_NAME}
        </button>
        <p className="brand">{APP_NAME}</p>
        <h1>Learn with Rebbi</h1>
        <p className="lede">
          Request a real-life rabbi. If none are free right now, leave a message
          or learn with Guide.
        </p>

        {error && <p className="bad">{error}</p>}
        {notice && <p className="soft">{notice}</p>}
        {busy && rabbis === null && <p className="soft">Checking availability…</p>}

        {rabbis && !available && (
          <section className="panel-card path-card">
            <h2>No rebbeim are available</h2>
            <p className="lede panel-lede">
              You can leave a note for rebbeim (visible in the admin console),
              or start with Guide now.
            </p>
            <form
              className="setup"
              onSubmit={async (e) => {
                e.preventDefault()
                setBusy(true)
                setError(null)
                setNotice(null)
                try {
                  await createRabbiWaitMessage({
                    name: waitName,
                    message: waitMessage,
                  })
                  setNotice('Message saved. Rebbeim and admins can see it.')
                  setWaitMessage('')
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : 'Could not save message',
                  )
                } finally {
                  setBusy(false)
                }
              }}
            >
              <label className="full">
                <span>Your name</span>
                <input
                  value={waitName}
                  onChange={(e) => setWaitName(e.target.value)}
                  required
                />
              </label>
              <label className="full">
                <span>Message for rebbeim</span>
                <textarea
                  value={waitMessage}
                  onChange={(e) => setWaitMessage(e.target.value)}
                  rows={4}
                  required
                  minLength={3}
                />
              </label>
              <button type="submit" className="btn-main" disabled={busy}>
                Leave a message
              </button>
            </form>
            <button
              type="button"
              className="btn-main btn-secondary"
              onClick={onLearnWithGuide}
            >
              Learn with Guide instead
            </button>
          </section>
        )}

        {rabbis && available && (
          <section className="panel-card path-card">
            <h2>{rabbis.length} rabbi{rabbis.length === 1 ? '' : 's'} available</h2>
            <ul className="rabbi-available-list">
              {rabbis.map((r) => (
                <li key={r.id}>
                  <strong>{r.displayName || r.username}</strong>
                  {r.bio ? <p className="soft">{r.bio}</p> : null}
                </li>
              ))}
            </ul>
            <form
              className="setup"
              onSubmit={async (e) => {
                e.preventDefault()
                setBusy(true)
                setError(null)
                setNotice(null)
                try {
                  const request = await createLearningRequest(message)
                  setRequests((prev) => [request, ...prev])
                  setNotice('Request sent. A rabbi can claim it from their panel.')
                } catch (err) {
                  const text =
                    err instanceof Error ? err.message : 'Could not send request'
                  setError(text)
                  if (/no rebbeim are available/i.test(text)) {
                    await refresh()
                  }
                } finally {
                  setBusy(false)
                }
              }}
            >
              <label className="full">
                <span>Note for the rabbi</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  required
                  minLength={3}
                />
              </label>
              <button type="submit" className="btn-main" disabled={busy}>
                Request a rabbi
              </button>
            </form>
            <button
              type="button"
              className="linkish tiny tour-link"
              onClick={onLearnWithGuide}
            >
              Or learn with Guide now
            </button>
          </section>
        )}

        {requests.length > 0 && (
          <section className="panel-card path-card">
            <h2>Your requests</h2>
            <ul className="ticket-list">
              {requests.map((r) => (
                <li key={r.id}>
                  <div className="ticket-top">
                    <strong>{r.message.slice(0, 72)}</strong>
                    <span className={`ticket-status ${r.status}`}>{r.status}</span>
                  </div>
                  <p className="soft">
                    {r.rabbiUsername
                      ? `With ${r.rabbiUsername}`
                      : 'Waiting for a rabbi'}{' '}
                    · {new Date(r.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
