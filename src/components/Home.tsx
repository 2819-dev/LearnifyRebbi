import { useMemo, useState } from 'react'
import curriculum from '../data/hashavas-aveidah.json'
import { APP_NAME, REBBE_VOICES } from '../lib/brand'
import { unlockAudio } from '../lib/rebbe'
import { normalizeDaf } from '../lib/sefaria'

type Props = {
  onStart: (opts: { daf: string; voiceId: string }) => void
}

export function Home({ onStart }: Props) {
  const [daf, setDaf] = useState(curriculum.defaultDaf)
  const [voiceId, setVoiceId] = useState<string>(REBBE_VOICES[0].id)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = useMemo(() => normalizeDaf(daf), [daf])
  const selected = REBBE_VOICES.find((v) => v.id === voiceId) || REBBE_VOICES[0]

  return (
    <div className="shell">
      <main className="home">
        <p className="brand">{APP_NAME}</p>
        <h1>Turn your sound on.</h1>
        <p className="lede">
          The Rebbe talks through your speakers. You answer with your voice. No
          reading his words on screen.
        </p>

        <form
          className="setup"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            setStarting(true)
            try {
              // Unlock speakers inside this click so later speech can play.
              await unlockAudio()
              onStart({ daf: preview, voiceId })
            } catch (err) {
              setStarting(false)
              setError(
                err instanceof Error
                  ? err.message
                  : 'Could not turn speakers on.',
              )
            }
          }}
        >
          <div className="setup-row">
            <label>
              <span>Masechta</span>
              <strong>Bava Metzia</strong>
            </label>
            <label>
              <span>Daf</span>
              <input
                value={daf}
                onChange={(e) => setDaf(e.target.value)}
                placeholder="21a"
                inputMode="text"
                autoComplete="off"
              />
            </label>
          </div>

          <label className="full">
            <span>Rebbe voice</span>
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
            >
              {REBBE_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} — {v.blurb}
                </option>
              ))}
            </select>
            <small>{selected.blurb}</small>
          </label>

          {error && <p className="bad">{error}</p>}

          <button type="submit" className="btn-main" disabled={starting}>
            {starting ? 'Starting…' : 'Begin — hear the Rebbe'}
          </button>
        </form>
      </main>
    </div>
  )
}
