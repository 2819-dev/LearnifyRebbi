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
    return <>{text}</>
  }

  const parts = splitHebrewWords(text)
  const kinds = markWordKinds(parts, highlights.marks)
  const real = realWordIndexes(parts)
  const readingPart =
    highlights.readingIndex != null ? real[highlights.readingIndex] : null

  return (
    <>
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
    </>
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
    <aside className={`vilna-side ${side}`} aria-label={labelHe}>
      <div className="vilna-side-label" dir="rtl" lang="he">
        {labelHe}
      </div>
      <div className="vilna-side-body" dir="rtl" lang="he">
        {focused.length === 0 && rest.length === 0 && (
          <p className="daf-empty">־</p>
        )}
        {focused.map((n) => (
          <p key={n.id} className="vilna-rashi focused">
            {n.he}
          </p>
        ))}
        {rest.map((n) => (
          <p key={n.id} className="vilna-rashi">
            {n.he}
          </p>
        ))}
      </div>
    </aside>
  )
}

function splitRef(ref: string, heRef: string) {
  const en = ref.replace(/^Bava[_\s]Metzia\s*/i, '').trim() || ref
  return {
    masechtaHe: 'בבא מציעא',
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
    <div className="vilna-page" aria-label="Gemara page">
      <header className="vilna-head" dir="rtl">
        <span className="vilna-head-masechta" lang="he">
          {head.masechtaHe}
        </span>
        <span className="vilna-head-folio" lang="he">
          {head.folioHe}
        </span>
        <span className="vilna-head-en" lang="en" dir="ltr">
          {head.folioEn}
        </span>
      </header>

      <div className="vilna-rule" aria-hidden />

      <div className="vilna-grid">
        <CommentaryColumn
          labelHe="תוספות"
          notes={page.tosafot}
          activeLine={lineIndex}
          side="tosafot"
        />

        <section className="vilna-center" aria-label="Gemara">
          <div className="vilna-center-body" dir="rtl" lang="he">
            {page.hebrew.map((line, i) => {
              if (!line.trim()) return null
              const mishnah = isMishnahLine(page.english[i] || '', line)
              const gemaraMark = isGemaraMarker(page.english[i] || '', line)
              if (gemaraMark) sawGemara = true
              const kind = mishnah
                ? 'mishnah'
                : gemaraMark
                  ? 'gemara-mark'
                  : sawGemara
                    ? 'gemara'
                    : 'gemara'
              return (
                <button
                  key={i}
                  type="button"
                  className={`vilna-line ${kind}${i === lineIndex ? ' active' : ''}`}
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
