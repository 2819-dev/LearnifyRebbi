import { useState } from 'react'
import { createTicket } from '../lib/account'

type Props = {
  onClose: () => void
  defaultName?: string
  defaultPhone?: string
}

export function SupportForm({ onClose, defaultName = '', defaultPhone = '' }: Props) {
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState(defaultPhone)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="onboard" role="dialog" aria-modal="true">
        <div className="onboard-card">
          <h2>Message received</h2>
          <p className="onboard-body">
            Thank you. Our team will get back to you soon.
          </p>
          <div className="onboard-actions">
            <button type="button" className="btn-main" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-label="Support">
      <div className="onboard-card">
        <h2>How can we help?</h2>
        <p className="onboard-body">
          Send a short note and we will follow up with you.
        </p>
        <form
          className="setup"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            try {
              await createTicket({ name, phone, subject, body })
              setDone(true)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not send')
            } finally {
              setBusy(false)
            }
          }}
        >
          <label className="full">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="full">
            <span>Phone (optional)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="So we can reach you"
            />
          </label>
          <label className="full">
            <span>Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </label>
          <label className="full">
            <span>Message</span>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </label>
          {error && <p className="bad">{error}</p>}
          <div className="onboard-btns">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-main" disabled={busy}>
              {busy ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
