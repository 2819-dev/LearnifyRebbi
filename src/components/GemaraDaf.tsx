import {
  isGemaraMarker,
  isMishnahLine,
  notesForLine,
  type CommentaryNote,
  type GemaraPage,
} from '../lib/sefaria'

type Props = {
  page: GemaraPage
  lineIndex: number
  onSelectLine: (index: number) => void
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

export function GemaraDaf({ page, lineIndex, onSelectLine }: Props) {
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
                  <span className="daf-line-text">{line}</span>
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
