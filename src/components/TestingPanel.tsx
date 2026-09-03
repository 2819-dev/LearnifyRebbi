import { useEffect, useState } from 'react'
import {
  fetchTraining,
  saveTraining,
  trainingChat,
  type Account,
  type TrainingRow,
} from '../lib/account'
import { APP_NAME } from '../lib/brand'

type Props = {
  account: Account
  onBack: () => void
  onOpenAdmin?: () => void
}

type Turn = { role: 'user' | 'model'; content: string }

export function TestingPanel({ account, onBack, onOpenAdmin }: Props) {
  const [prompt, setPrompt] = useState('')
  const [reply, setReply] = useState('')
  const [correction, setCorrection] = useState('')
  const [history, setHistory] = useState<Turn[]>([])
  const [saved, setSaved] = useState<TrainingRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void fetchTraining()
      .then(setSaved)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load training'),
      )
  }, [])

  async function runTrial() {
    const q = prompt.trim()
    if (!q) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const next = await trainingChat(q, history)
      setReply(next)
      setHistory((prev) => [
        ...prev,
        { role: 'user', content: q },
        { role: 'model', content: next },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Training chat failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveCorrection() {
    if (!prompt.trim() || !correction.trim()) {
      setError('Add a prompt and how the Rebbi should answer.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const row = await saveTraining({
        prompt: prompt.trim(),
        aiResponse: reply,
        correction: correction.trim(),
      })
      setSaved((prev) => [row, ...prev])
      setNotice('Saved. Future lessons will use this coaching note.')
      setCorrection('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shell panel-shell">
      <header className="panel-bar">
        <div>
          <button type="button" className="linkish" onClick={onBack}>
            {APP_NAME}
          </button>
          <p className="panel-sub">Testing · {account.username}</p>
        </div>
        <div className="panel-actions">
          {account.role === 'admin' && onOpenAdmin && (
            <button type="button" onClick={onOpenAdmin}>
              Admin panel
            </button>
          )}
        </div>
      </header>

      <section className="panel-card">
        <h2>Train the Rebbi</h2>
        <p className="lede panel-lede">
          Ask something a student might ask. See the reply. Then teach how it
          should answer next time.
        </p>

        <label className="full">
          <span>Student prompt</span>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. What is ye’ush?"
          />
        </label>
        <button
          type="button"
          className="btn-main"
          disabled={busy || !prompt.trim()}
          onClick={() => void runTrial()}
        >
          {busy ? 'Thinking…' : 'See reply'}
        </button>

        {reply && (
          <div className="train-reply">
            <h3>Current reply</h3>
            <p>{reply}</p>
          </div>
        )}

        <label className="full">
          <span>Better response / coaching note</span>
          <textarea
            rows={4}
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="Tell the Rebbi how to answer this kind of question."
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveCorrection()}
        >
          Save coaching note
        </button>
        {notice && <p className="soft">{notice}</p>}
        {error && <p className="bad">{error}</p>}
      </section>

      <section className="panel-card">
        <h2>Saved notes</h2>
        {saved.length === 0 && <p className="soft">No coaching notes yet.</p>}
        <ul className="train-list">
          {saved.map((row) => (
            <li key={row.id}>
              <strong>{row.prompt}</strong>
              <p className="soft">Was: {row.aiResponse || '—'}</p>
              <p>Coach: {row.correction}</p>
              <p className="soft">
                {row.testerUsername} · {new Date(row.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
