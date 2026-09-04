import { useEffect, useState } from 'react'
import {
  createLearningRequest,
  createRabbiWaitMessage,
  fetchAvailableRabbis,
  fetchMyLearningRequests,
  learningRequestStatusLabel,
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

function formatContact(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return null
  return raw
}

function rebbiLabel(r: LearningRequest) {
  return r.rabbiDisplayName || r.rabbiUsername || 'your Rebbi'
}

export function RabbiRequestScreen({
  account,
  onLearnWithGuide,
  onBack,
}: Props) {
  const [rabbis, setRabbis] = useState<RabbiProfile[] | null>(null)
  const [requests, setRequests] = useState<LearningRequest[]>([])
  const [message, setMessage] = useState(
    'I would like to learn Hashavas Aveidah with a real Rebbi.',
  )
  const [waitName, setWaitName] = useState(account.username)
  const [waitMessage, setWaitMessage] = useState(
    'Please let me know when a Rebbi is available to learn with.',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function refresh(opts?: { quiet?: boolean }) {
    if (!opts?.quiet) {
      setBusy(true)
      setError(null)
    }
    try {
      const [list, mine] = await Promise.all([
        fetchAvailableRabbis(),
        fetchMyLearningRequests(),
      ])
      setRabbis(list)
      setRequests(mine)
    } catch (err) {
      if (!opts?.quiet) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load Rebbeim. Please try again.',
        )
        setRabbis([])
      }
    } finally {
      if (!opts?.quiet) setBusy(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    const hasOpen = requests.some((r) => r.status === 'open')
    if (!hasOpen) return
    const id = window.setInterval(() => {
      void refresh({ quiet: true })
    }, 12000)
    return () => window.clearInterval(id)
  }, [requests])

  const available = (rabbis || []).length > 0
  const hasOpenRequest = requests.some((r) => r.status === 'open')

  return (
    <div className="shell home-shell">
      <div className="home-atmosphere" aria-hidden>
        <span>גמ׳</span>
      </div>
      <main className="home auth-home auth-home-wide rebbe-request-home">
        <button type="button" className="linkish tiny auth-back" onClick={onBack}>
          ← Back to {APP_NAME}
        </button>
        <p className="brand">{APP_NAME}</p>
        <h1>Learn with Rebbi</h1>
        <p className="lede">
          Request a real-life Rebbi. When someone accepts, you exchange phone
          numbers here so you can set up a time to learn.
        </p>

        {error && <p className="bad auth-error">{error}</p>}
        {notice && <p className="soft notice-banner">{notice}</p>}
        {busy && rabbis === null && <p className="soft">Checking availability…</p>}

        {rabbis && !available && (
          <section className="submitted-card path-card">
            <h2>No Rebbeim are available</h2>
            <p className="lede panel-lede">
              Leave a note for Rebbeim, or start with Guide now.
            </p>
            <form
              className="inline-form"
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
                  setNotice('Message saved. We will share it with Rebbeim.')
                  setWaitMessage('')
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : 'Could not save message. Please try again.',
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
                <span>Message for Rebbeim</span>
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
          <section className="submitted-card path-card">
            <h2>
              {rabbis.length === 1
                ? '1 Rebbi available'
                : `${rabbis.length} Rebbeim available`}
            </h2>
            <ul className="rabbi-available-list">
              {rabbis.map((r) => (
                <li key={r.id}>
                  <strong>{r.displayName || r.username}</strong>
                  {r.bio ? <p className="soft">{r.bio}</p> : null}
                </li>
              ))}
            </ul>
            {hasOpenRequest ? (
              <p className="soft path-note">
                You already have a waiting request. This page updates when a
                Rebbi accepts.
              </p>
            ) : (
              <form
                className="inline-form"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setBusy(true)
                  setError(null)
                  setNotice(null)
                  try {
                    const request = await createLearningRequest(message)
                    setRequests((prev) => [request, ...prev])
                    setNotice(
                      'Request sent. When a Rebbi accepts, their phone number will appear below.',
                    )
                  } catch (err) {
                    const text =
                      err instanceof Error
                        ? err.message
                        : 'Could not send request. Please try again.'
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
                  <span>Note for the Rebbi</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    required
                    minLength={3}
                  />
                </label>
                <button type="submit" className="btn-main" disabled={busy}>
                  Request a Rebbi
                </button>
              </form>
            )}
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
          <section className="submitted-card path-card">
            <h2>Your requests</h2>
            <ul className="ticket-list">
              {requests.map((r) => {
                const contact = formatContact(r.rebbiContact)
                const name = rebbiLabel(r)
                return (
                  <li key={r.id}>
                    <div className="ticket-top">
                      <strong>{r.message.slice(0, 72)}</strong>
                      <span className={`ticket-status ${r.status}`}>
                        {learningRequestStatusLabel(r.status)}
                      </span>
                    </div>
                    {r.status === 'open' && (
                      <p className="soft">
                        Waiting for a Rebbi · {new Date(r.createdAt).toLocaleString()}
                      </p>
                    )}
                    {r.status !== 'open' && (
                      <>
                        <p className="soft">
                          Matched with {name} ·{' '}
                          {new Date(r.updatedAt || r.createdAt).toLocaleString()}
                        </p>
                        {contact ? (
                          <p className="match-contact">
                            Rebbi phone:{' '}
                            <a href={`tel:${contact}`}>{contact}</a>
                          </p>
                        ) : (
                          <p className="soft">
                            Contact details will show once the match is ready.
                          </p>
                        )}
                        {contact && r.status === 'claimed' && (
                          <p className="soft">
                            Call or text {name} to arrange a time to learn.
                          </p>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className="linkish tiny tour-link"
              onClick={() => void refresh()}
              disabled={busy}
            >
              Refresh status
            </button>
          </section>
        )}
      </main>
    </div>
  )
}
