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
  notes,
  activeLine,
  side,
}: {
  labelHe: string
  notes: CommentaryNote[]
  activeLine: number
  side: 'rashi' | 'tosafot'
}) {
  const focused = notesForLine(notes, activeLine)
  const rest = notes.filter((n) => n.anchorVerse !== activeLine + 1)

  return (
    <aside className={`daf-col ${side}`} aria-label={labelHe}>
      <div className="daf-col-label" dir="rtl" lang="he">
        <span>{labelHe}</span>
      </div>
      <div className="daf-col-scroll" dir="rtl" lang="he">
        {focused.length === 0 && rest.length === 0 && (
          <p className="daf-empty">—</p>
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

function splitRef(ref: string, heRef: string) {
  // e.g. "Bava Metzia 21a" / Hebrew folio
  const en = ref.replace(/^Bava[_\s]Metzia\s*/i, '').trim() || ref
  return {
    masechtaHe: 'בבא מציעא',
    masechtaEn: 'Bava Metzia',
    folioHe: heRef || en,
    folioEn: en,
  }
}

export function GemaraDaf({
  page,
  lineIndex,
  onSelectLine,
  highlights,
}: Props) {
  let sawGemara = false
  const head = splitRef(page.ref, page.heRef)

  return (
    <div className="daf-page" aria-label="Gemara page">
      <header className="daf-page-head" dir="rtl">
        <span className="daf-head-side" lang="he">
          {head.masechtaHe}
        </span>
        <span className="daf-head-center" lang="he">
          {head.folioHe}
        </span>
        <span className="daf-head-side daf-head-en" lang="en" dir="ltr">
          {head.folioEn}
        </span>
      </header>

      <div className="daf-body">
        <CommentaryColumn
          labelHe="תוספות"
          notes={page.tosafot}
          activeLine={lineIndex}
          side="tosafot"
        />

        <section className="daf-col center" aria-label="Gemara">
          <div className="daf-center-scroll" dir="rtl" lang="he">
            {page.hebrew.map((line, i) => {
              if (!line.trim()) return null
              const mishnah = isMishnahLine(page.english[i] || '', line)
              const gemaraMark = isGemaraMarker(page.english[i] || '', line)
              if (gemaraMark) sawGemara = true
              const kind = mishnah
                ? 'mishnah'
                : gemaraMark
                  ? 'gemara-mark'
                  : 'gemara'
              return (
                <button
                  key={i}
                  type="button"
                  className={`daf-line ${kind}${i === lineIndex ? ' active' : ''}${sawGemara && !mishnah && !gemaraMark ? ' after-g' : ''}`}
                  onClick={() => onSelectLine(i)}
                >
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
          notes={page.rashi}
          activeLine={lineIndex}
          side="rashi"
        />
      </div>
    </div>
  )
}
