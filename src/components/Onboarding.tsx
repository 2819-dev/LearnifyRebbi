import { useEffect, useState } from 'react'
import { APP_NAME } from '../lib/brand'
import { HIGHLIGHT_LEGEND } from '../lib/curriculum'

const STEPS = [
  {
    title: 'Your Gemara',
    body: 'The amud opens like a printed Vilna page — large vocalized Gemara in the middle, Rashi and Tosafot wrapping around it. Tap a line to see the English and learn it with the Rebbi.',
  },
  {
    title: 'Follow along',
    body: 'As the Rebbi teaches, words get marked like a used sefer — underlines and soft circles — so you can see what he is reading.',
  },
  {
    title: 'Highlight colors',
    body: 'Each color means something different. Learn them once — then the page will guide you.',
    showLegend: true,
  },
  {
    title: 'Speak or type',
    body: 'Choose Speak if you want the Rebbi to talk out loud. Choose Text if you would rather type, like a chat.',
  },
  {
    title: 'Guide or Rebbi',
    body: 'Learn with Guide for a Rebbi on the amud, or Learn with Rebbi to request a real-life Rebbi when one is available.',
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
