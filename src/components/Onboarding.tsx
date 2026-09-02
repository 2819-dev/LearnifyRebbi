import { useEffect, useState } from 'react'
import { APP_NAME } from '../lib/brand'
import { HIGHLIGHT_LEGEND } from '../lib/curriculum'

const STEPS = [
  {
    title: 'Your Gemara',
    body: 'The page opens like a real amud — Gemara in the center, Rashi and Tosafot at the sides. Tap any line to learn it.',
  },
  {
    title: 'Follow along',
    body: 'As the Rebbe teaches, words light up so you can see what he is reading and what matters on the page.',
  },
  {
    title: 'Highlight colors',
    body: 'Each color means something different. Learn them once — then the page will guide you.',
    showLegend: true,
  },
  {
    title: 'Your voice',
    body: 'The Rebbe says a short Hebrew phrase, then the English. You repeat it. Then he explains. Mute when you need quiet — use Continue for the next piece, or Replay if sound did not start.',
  },
] as const

type Props = {
  onDone: () => void
}

export function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const last = step === STEPS.length - 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="onboard-card">
        <p className="onboard-brand">{APP_NAME}</p>
        <p className="onboard-step">
          {step + 1} / {STEPS.length}
        </p>
        <h2>{current.title}</h2>
        <p className="onboard-body">{current.body}</p>

        {'showLegend' in current && current.showLegend && (
          <ul className="legend">
            {HIGHLIGHT_LEGEND.map((item) => (
              <li key={item.id}>
                <span
                  className="legend-swatch"
                  style={{ background: item.swatch }}
                  aria-hidden
                />
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.meaning}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="onboard-actions">
          <div className="onboard-dots" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={i === step ? 'on' : ''} />
            ))}
          </div>
          <div className="onboard-btns">
            {step > 0 && (
              <button type="button" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            )}
            <button
              type="button"
              className="btn-main"
              onClick={() => {
                if (last) onDone()
                else setStep((s) => s + 1)
              }}
            >
              {last ? 'Start learning' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
