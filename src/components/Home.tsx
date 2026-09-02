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
    <div className="shell">
      <main className="home">
        <p className="brand">{APP_NAME}</p>
        <h1>One student. One Rebbe. One open Gemara.</h1>
        <p className="lede">
          He speaks to you. You speak back. Hebrew words welcome. We begin with
          Bava Metzia — Hashavas Aveidah.
        </p>

        <form
          className="setup"
          onSubmit={(e) => {
            e.preventDefault()
            onStart({ daf: preview, voiceId })
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

          <button type="submit" className="btn-main">
            Begin
          </button>
        </form>
      </main>
    </div>
  )
}
