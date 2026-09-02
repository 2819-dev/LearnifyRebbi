import {
  isGemaraMarker,
  isMishnahLine,
  notesForLine,
  type CommentaryNote,
  type GemaraPage,
} from '../lib/sefaria'
import {
  markWordKinds,
  realWordIndexes,
  splitHebrewWords,
  type ActiveHighlights,
} from '../lib/highlights'

type Props = {
  page: GemaraPage
  lineIndex: number
  onSelectLine: (index: number) => void
  highlights?: ActiveHighlights | null
}

function HighlightedLine({
  text,
  highlights,
  isActive,
}: {
  text: string
  highlights: ActiveHighlights | null | undefined
  isActive: boolean
}) {
  if (!isActive || !highlights) {
    return <span className="daf-line-text">{text}</span>
  }

  const parts = splitHebrewWords(text)
  const kinds = markWordKinds(parts, highlights.marks)
  const real = realWordIndexes(parts)
  const readingPart =
    highlights.readingIndex != null ? real[highlights.readingIndex] : null

  return (
    <span className="daf-line-text">
      {parts.map((part, i) => {
        if (!/\S/.test(part)) return <span key={i}>{part}</span>
        const kind = kinds[i]
        const reading = readingPart === i
        const className = [
          'daf-word',
          kind ? `hl-${kind}` : '',
          reading ? 'hl-reading' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <span key={i} className={className || undefined}>
            {part}
          </span>
        )
      })}
    </span>
  )
}

function CommentaryColumn({
  labelHe,
  labelEn,
  notes,
  activeLine,
  side,
}: {
  labelHe: string
  labelEn: string
  notes: CommentaryNote[]
  activeLine: number
  side: 'rashi' | 'tosafot'
}) {
  const focused = notesForLine(notes, activeLine)
  const rest = notes.filter((n) => n.anchorVerse !== activeLine + 1)

  return (
    <aside className={`daf-col ${side}`} aria-label={labelEn}>
      <div className="daf-col-label">
        <span lang="he" dir="rtl">
          {labelHe}
        </span>
        <small>{labelEn}</small>
      </div>
      <div className="daf-col-scroll" dir="rtl" lang="he">
        {focused.length === 0 && rest.length === 0 && (
          <p className="daf-empty">No {labelEn} on this amud yet.</p>
        )}
        {focused.map((n) => (
          <p key={n.id} className="daf-comment focused">
            {n.he}
          </p>
        ))}
        {rest.map((n) => (
          <p key={n.id} className="daf-comment">
            {n.he}
          </p>
        ))}
      </div>
    </aside>
  )
}

export function GemaraDaf({
  page,
  lineIndex,
  onSelectLine,
  highlights,
}: Props) {
  let sawGemara = false

  return (
    <div className="daf-page" aria-label="Gemara page">
      <div className="daf-page-head">
        <span className="daf-folio" dir="rtl" lang="he">
          {page.heRef || page.ref}
        </span>
        <span className="daf-folio-en">{page.ref}</span>
      </div>

      <div className="daf-body">
        <CommentaryColumn
          labelHe="תוספות"
          labelEn="Tosafot"
          notes={page.tosafot}
          activeLine={lineIndex}
          side="tosafot"
        />

        <section className="daf-col center" aria-label="Gemara">
          <div className="daf-col-label">
            <span lang="he" dir="rtl">
              גמרא
            </span>
            <small>
              Line {lineIndex + 1} / {page.hebrew.length}
            </small>
          </div>
          <div className="daf-center-scroll" dir="rtl" lang="he">
            {page.hebrew.map((line, i) => {
              if (!line.trim()) return null
              const mishnah = isMishnahLine(page.english[i] || '', line)
              const gemaraMark = isGemaraMarker(page.english[i] || '', line)
              if (gemaraMark) sawGemara = true
              const kind = mishnah
                ? 'mishnah'
                : sawGemara || gemaraMark
                  ? 'gemara'
                  : 'gemara'
              return (
                <button
                  key={i}
                  type="button"
                  className={`daf-line ${kind}${i === lineIndex ? ' active' : ''}`}
                  onClick={() => onSelectLine(i)}
                >
                  <span className="daf-line-num">{i + 1}</span>
                  <HighlightedLine
                    text={line}
                    highlights={highlights}
                    isActive={i === lineIndex}
                  />
                </button>
              )
            })}
          </div>
        </section>

        <CommentaryColumn
          labelHe="רש״י"
          labelEn="Rashi"
          notes={page.rashi}
          activeLine={lineIndex}
          side="rashi"
        />
      </div>
    </div>
  )
}
