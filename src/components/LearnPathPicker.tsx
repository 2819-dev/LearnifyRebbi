export type LearnPath = 'guide' | 'rebbe'

const OPTIONS: { id: LearnPath; title: string; blurb: string }[] = [
  {
    id: 'guide',
    title: 'Learn with Guide',
    blurb: 'A Rebbi on the amud.',
  },
  {
    id: 'rebbe',
    title: 'Learn with Rebbi',
    blurb: 'Request a real-life Rebbi.',
  },
]

type Props = {
  value: LearnPath
  onChange: (path: LearnPath) => void
}

export function LearnPathPicker({ value, onChange }: Props) {
  return (
    <div className="talk-choice">
      <span>Who teaches you</span>
      <div className="mode-toggle" role="radiogroup" aria-label="Who teaches you">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={value === opt.id}
            className={value === opt.id ? 'on' : ''}
            onClick={() => onChange(opt.id)}
          >
            {opt.title}
            <small>{opt.blurb}</small>
          </button>
        ))}
      </div>
    </div>
  )
}
