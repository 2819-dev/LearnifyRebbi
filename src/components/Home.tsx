import { useEffect, useMemo, useState } from 'react'
import curriculum from '../data/hashavas-aveidah.json'
import { normalizeDaf } from '../lib/sefaria'
import { listEnglishVoices, type VoiceOption } from '../lib/speech'

type Props = {
  onStart: (opts: { daf: string; voiceId: string | null }) => void
}

export function Home({ onStart }: Props) {
  const [daf, setDaf] = useState(curriculum.defaultDaf)
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [voiceId, setVoiceId] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => {
      const list = listEnglishVoices()
      setVoices(list)
      setVoiceId((prev) => prev ?? list[0]?.id ?? null)
    }
    refresh()
    window.speechSynthesis?.addEventListener('voiceschanged', refresh)
    return () =>
      window.speechSynthesis?.removeEventListener('voiceschanged', refresh)
  }, [])

  const preview = useMemo(() => normalizeDaf(daf), [daf])

  return (
    <div className="shell home-shell">
      <div className="atmosphere" aria-hidden="true" />
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          <span className="brand-dot" />
        </div>
        <p className="eyebrow">Gemara with a patient Rebbe</p>
      </header>

      <main className="home-hero">
        <p className="brand">Lomed</p>
        <h1>Learn Gemara out loud, one line at a time.</h1>
        <p className="lede">
          Your Rebbe explains in English while you follow the Hebrew on the page.
          We begin with Bava Metzia — Hashavas Aveidah.
        </p>

        <form
          className="start-form"
          onSubmit={(e) => {
            e.preventDefault()
            onStart({ daf: preview, voiceId })
          }}
        >
          <label className="field">
            <span>Masechta</span>
            <div className="locked-select">Bava Metzia · Eilu Metziot</div>
          </label>

          <label className="field">
            <span>Daf to start from</span>
            <input
              value={daf}
              onChange={(e) => setDaf(e.target.value)}
              placeholder="21a"
              inputMode="text"
              autoComplete="off"
            />
            <small>Try 21a for the Hashavas Aveidah mishna.</small>
          </label>

          <label className="field">
            <span>Rebbe voice</span>
            <select
              value={voiceId ?? ''}
              onChange={(e) => setVoiceId(e.target.value || null)}
            >
              {voices.length === 0 && (
                <option value="">Browser default voice</option>
              )}
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <small>Uses free voices built into your browser.</small>
          </label>

          <button type="submit" className="primary-btn">
            Start learning
          </button>
        </form>
      </main>

      <footer className="home-foot">
        <p>
          Text from Sefaria · Grounded notes on Hashavas Aveidah · Not a replacement
          for your real Rebbe or a posek
        </p>
      </footer>
    </div>
  )
}
