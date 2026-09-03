import { useLayoutEffect, useRef, useState } from 'react'
import { bavaMetziaPerek, formatAmudHe, splitDibbur } from '../lib/hebrew'
import {
  isGemaraMarker,
  isMishnahLine,
  notesForLine,
  type CommentaryNote,
  type GemaraPage,
  type GutterNote,
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
  dropFirst,
}: {
  text: string
  highlights: ActiveHighlights | null | undefined
  isActive: boolean
  dropFirst?: boolean
}) {
  const parts = splitHebrewWords(text)
  const kinds = isActive && highlights ? markWordKinds(parts, highlights.marks) : []
  const real = realWordIndexes(parts)
  const readingPart =
    isActive && highlights?.readingIndex != null
      ? real[highlights.readingIndex]
      : null
  const firstWord = dropFirst ? parts.findIndex((part) => /\S/.test(part)) : -1

  return (
    <>
      {parts.map((part, i) => {
        if (!/\S/.test(part)) return <span key={i}>{part}</span>
        const kind = kinds[i]
        const reading = readingPart === i
        const incipit = firstWord === i
        const className = [
          'daf-word',
          incipit ? 'vilna-incipit' : '',
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

function CommentaryStream({
  notes,
  activeLine,
  label,
}: {
  notes: CommentaryNote[]
  activeLine: number
  label: string
}) {
  const focused = new Set(notesForLine(notes, activeLine).map((n) => n.id))
  return (
    <div className="vilna-stream" dir="rtl" lang="he">
      {notes.length === 0 && <span className="vilna-stream-empty">־</span>}
      {notes.map((n) => {
        const { lemma, body } = splitDibbur(n.he)
        return (
          <span
            key={n.id}
            className={`vilna-note${focused.has(n.id) ? ' focused' : ''}`}
          >
            {lemma ? <strong className="vilna-dibbur">{lemma} </strong> : null}
            {body}
            {' '}
          </span>
        )
      })}
      <span className="vilna-sr">{label}</span>
    </div>
  )
}

function Gutter({ notes, label }: { notes: GutterNote[]; label: string }) {
  if (notes.length === 0) return <aside className="vilna-gutter" aria-hidden />
  return (
    <aside className="vilna-gutter" aria-label={label}>
      {notes.map((n) => (
        <span key={n.id} className="vilna-gutter-item">
          {n.he}
        </span>
      ))}
    </aside>
  )
}

function cleanEnglish(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^MISHNA:\s*/i, '')
    .replace(/^GEMARA:\s*/i, '')
    .trim()
}

export function GemaraDaf({
  page,
  lineIndex,
  onSelectLine,
  highlights,
}: Props) {
  const islandRef = useRef<HTMLElement>(null)
  const [islandH, setIslandH] = useState(240)
  const { dafHe, amudHe } = formatAmudHe(page.daf)
  const perek = bavaMetziaPerek(page.daf)
  const verso = /b$/i.test(page.daf)
  const firstMishnah = page.hebrew.findIndex(
    (line, i) => line.trim() && isMishnahLine(page.english[i] || '', line),
  )
  const english = cleanEnglish(page.english[lineIndex] || '')

  useLayoutEffect(() => {
    const el = islandRef.current
    if (!el) return
    const measure = () => setIslandH(Math.max(el.offsetHeight, 96))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [page, lineIndex])

  return (
    <div className="vilna-page" aria-label="Gemara page">
      <header className="vilna-head" dir="rtl" lang="he">
        <div className="vilna-head-cell vilna-head-side">
          <span className="vilna-head-daf">{dafHe}</span>
          <span className="vilna-head-amud">{amudHe}</span>
        </div>
        <div className="vilna-head-cell vilna-head-mid">
          <span className="vilna-head-masechta">{page.heIndexTitle}</span>
          <span className="vilna-head-perek">
            פרק {perek.ordinalHe} · {perek.nameHe}
          </span>
        </div>
        <div className="vilna-head-cell vilna-head-side vilna-head-end">
          <span className="vilna-head-amud">{amudHe}</span>
          <span className="vilna-head-daf">{dafHe}</span>
        </div>
      </header>

      <div className="vilna-rule" aria-hidden>
        <span />
        <i />
        <span />
      </div>

      {english ? (
        <p className="vilna-english" lang="en">
          <span className="vilna-english-label">Translation</span>
          {english}
        </p>
      ) : null}

      <div
        className="vilna-sheet"
        style={{ ['--island-h' as string]: `${islandH}px` }}
      >
        <Gutter
          notes={verso ? page.einMishpat : page.masoret}
          label={verso ? 'עין משפט' : 'מסורת הש״ס'}
        />

        <div className={`vilna-amud${verso ? ' verso' : ''}`}>
          <section
            ref={islandRef}
            className="vilna-island"
            aria-label="גמרא"
            dir="rtl"
            lang="he"
          >
            {page.hebrew.map((line, i) => {
              if (!line.trim()) return null
              const mishnah = isMishnahLine(page.english[i] || '', line)
              const gemaraMark = isGemaraMarker(page.english[i] || '', line)
              const dropFirst =
                (mishnah && i === firstMishnah) || page.leadBig[i]
              const kind = mishnah
                ? 'mishnah'
                : gemaraMark
                  ? 'gemara-mark'
                  : 'gemara'
              return (
                <span
                  key={i}
                  role="button"
                  tabIndex={0}
                  className={`vilna-line ${kind}${i === lineIndex ? ' active' : ''}`}
                  onClick={() => onSelectLine(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectLine(i)
                    }
                  }}
                >
                  <HighlightedLine
                    text={line}
                    highlights={highlights}
                    isActive={i === lineIndex}
                    dropFirst={dropFirst}
                  />{' '}
                </span>
              )
            })}
          </section>

          <div className="vilna-rashi-col" aria-label="רש״י">
            <div className="vilna-col-label" aria-hidden>
              רש״י
            </div>
            <div className="vilna-spacer" aria-hidden />
            <CommentaryStream
              notes={page.rashi}
              activeLine={lineIndex}
              label="רש״י"
            />
          </div>
          <div className="vilna-tosafot-col" aria-label="תוספות">
            <div className="vilna-col-label" aria-hidden>
              תוספות
            </div>
            <div className="vilna-spacer" aria-hidden />
            <CommentaryStream
              notes={page.tosafot}
              activeLine={lineIndex}
              label="תוספות"
            />
          </div>
        </div>

        <Gutter
          notes={verso ? page.masoret : page.einMishpat}
          label={verso ? 'מסורת הש״ס' : 'עין משפט'}
        />
      </div>

      <div className="vilna-rule vilna-rule-foot" aria-hidden>
        <span />
        <i />
        <span />
      </div>
    </div>
  )
}
