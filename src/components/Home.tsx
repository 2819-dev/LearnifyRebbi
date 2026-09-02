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

  return (
    <div className="shell home-shell">
      <main className="home">
        <p className="brand">{APP_NAME}</p>
        <h1>Learn Gemara with a Rebbe beside you.</h1>
        <p className="lede">
          Open the page. Follow the words. Ask when you need to. Begin with Bava
          Metzia — Hashavas Aveidah.
        </p>

        <form
          className="setup"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            setStarting(true)
            try {
              await unlockAudio()
              onStart({ daf: preview, voiceId })
            } catch {
              setStarting(false)
              setError('Something went wrong. Please try again.')
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
                aria-label="Daf"
              />
            </label>
          </div>

          <label className="full">
            <span>Voice</span>
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              aria-label="Rebbe voice"
            >
              {REBBE_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="bad">{error}</p>}

          <button type="submit" className="btn-main" disabled={starting}>
            {starting ? 'Opening…' : 'Begin'}
          </button>
        </form>
      </main>
    </div>
  )
}
