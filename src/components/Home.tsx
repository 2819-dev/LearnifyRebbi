import { useMemo, useState } from 'react'
import curriculum from '../data/hashavas-aveidah.json'
import { APP_NAME, REBBE_VOICES } from '../lib/brand'
import { TRACTATES } from '../lib/curriculum'
import { unlockAudio } from '../lib/rebbe'
import { normalizeDaf } from '../lib/sefaria'

type Props = {
  onStart: (opts: { daf: string; voiceId: string; tractateId: string }) => void
  onShowTour?: () => void
}

export function Home({ onStart, onShowTour }: Props) {
  const [tractateId, setTractateId] = useState(TRACTATES[0].id)
  const [daf, setDaf] = useState(curriculum.defaultDaf)
  const [voiceId, setVoiceId] = useState<string>(REBBE_VOICES[0].id)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tractate = useMemo(
    () => TRACTATES.find((t) => t.id === tractateId) || TRACTATES[0],
    [tractateId],
  )
  const preview = useMemo(() => normalizeDaf(daf), [daf])

  return (
    <div className="shell home-shell">
      <main className="home">
        <p className="brand">{APP_NAME}</p>
        <h1>Learn Gemara with a Rebbe beside you.</h1>
        <p className="lede">
          Open the page. Follow the words as they light up. Ask when you need
          to.
        </p>

        <form
          className="setup"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!tractate.enabled) {
              setError('That sugya is coming soon. Choose an available topic.')
              return
            }
            setError(null)
            setStarting(true)
            try {
              await unlockAudio()
              onStart({ daf: preview, voiceId, tractateId: tractate.id })
            } catch {
              setStarting(false)
              setError('Something went wrong. Please try again.')
            }
          }}
        >
          <label className="full">
            <span>What you are learning</span>
            <select
              value={tractateId}
              onChange={(e) => {
                const next = TRACTATES.find((t) => t.id === e.target.value)
                setTractateId(e.target.value)
                if (next) setDaf(next.defaultDaf)
              }}
              aria-label="What you are learning"
            >
              {TRACTATES.map((t) => (
                <option key={t.id} value={t.id} disabled={!t.enabled}>
                  {t.label}
                  {!t.enabled ? ' (soon)' : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="setup-row">
            <label>
              <span>Masechta</span>
              <strong>{tractate.masechta}</strong>
            </label>
            <label>
              <span>Start from daf</span>
              <input
                value={daf}
                onChange={(e) => setDaf(e.target.value)}
                placeholder="21a"
                inputMode="text"
                autoComplete="off"
                aria-label="Start from daf"
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

          {onShowTour && (
            <button
              type="button"
              className="linkish tiny tour-link"
              onClick={onShowTour}
            >
              How Guide works
            </button>
          )}
        </form>
      </main>
    </div>
  )
}
