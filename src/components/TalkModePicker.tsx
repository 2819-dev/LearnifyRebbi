import { saveTalkMode, type TalkMode } from '../lib/brand'

const OPTIONS: { id: TalkMode; title: string; blurb: string }[] = [
  {
    id: 'voice',
    title: 'Speak',
    blurb: 'Talk out loud together.',
  },
  {
    id: 'text',
    title: 'Text',
    blurb: 'Type back and forth.',
  },
]

type Props = {
  value: TalkMode
  onChange: (mode: TalkMode) => void
  size?: 'lg' | 'sm'
}

export function TalkModePicker({ value, onChange, size = 'lg' }: Props) {
  return (
    <div className={`talk-choice talk-choice-${size}`}>
      <span>How you talk to the Rebbi</span>
      <div className="mode-toggle" role="radiogroup" aria-label="How you talk to the Rebbi">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={value === opt.id}
            className={value === opt.id ? 'on' : ''}
            onClick={() => {
              saveTalkMode(opt.id)
              onChange(opt.id)
            }}
          >
            {opt.title}
            {size === 'lg' ? <small>{opt.blurb}</small> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
