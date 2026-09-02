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
          <h2>Ticket sent</h2>
          <p className="onboard-body">Thanks — an admin can review it soon.</p>
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
        <h2>Support</h2>
        <p className="onboard-body">Send a short note. No email needed.</p>
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
            <span>Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
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
              {busy ? 'Sending…' : 'Send ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
