import { useMemo, useState } from 'react'
import curriculum from '../data/hashavas-aveidah.json'
import { APP_NAME, REBBE_VOICES } from '../lib/brand'
import { normalizeDaf } from '../lib/sefaria'

type Props = {
  onStart: (opts: { daf: string; voiceId: string }) => void
}

export function Home({ onStart }: Props) {
  const [daf, setDaf] = useState(curriculum.defaultDaf)
  const [voiceId, setVoiceId] = useState<string>(REBBE_VOICES[0].id)
  const preview = useMemo(() => normalizeDaf(daf), [daf])
  const selected = REBBE_VOICES.find((v) => v.id === voiceId) || REBBE_VOICES[0]

  return (
    <div className="page">
      <div className="wash" aria-hidden="true" />
      <header className="top">
        <div className="mark" aria-hidden="true">
          <span className="mark-canopy" />
          <span className="mark-trunk" />
        </div>
        <p className="kicker">Gemara class for kids</p>
      </header>

      <main className="hero">
        <p className="wordmark">{APP_NAME}</p>
        <h1>Learn Gemara like you are sitting in class.</h1>
        <p className="lede">
          Your Rebbe opens a real Gemara page, explains in clear English, and
          talks with you — you can speak into the mic or type. We start with
          Bava Metzia, Hashavas Aveidah.
        </p>

        <form
          className="panel start-panel"
          onSubmit={(e) => {
            e.preventDefault()
            onStart({ daf: preview, voiceId })
          }}
        >
          <label className="field">
            <span>Masechta</span>
            <div className="locked">Bava Metzia · Eilu Metziot</div>
          </label>

          <label className="field">
            <span>Daf</span>
            <input
              value={daf}
              onChange={(e) => setDaf(e.target.value)}
              placeholder="21a"
              inputMode="text"
              autoComplete="off"
            />
            <small>Start at 21a for the Hashavas Aveidah mishna.</small>
          </label>

          <label className="field">
            <span>Rebbe voice</span>
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
            >
              {REBBE_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <small>{selected.blurb}</small>
          </label>

          <button type="submit" className="btn-primary">
            Start class
          </button>
        </form>
      </main>

      <footer className="foot">
        Text from Sefaria. A study helper — not a replacement for your real Rebbe
        or a posek.
      </footer>
    </div>
  )
}
