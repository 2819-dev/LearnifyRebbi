export type CommentaryNote = {
  id: string
  anchorVerse: number
  he: string
  en: string
  title: string
}

export type GutterNote = {
  id: string
  he: string
}

export type GemaraPage = {
  ref: string
  heRef: string
  heIndexTitle: string
  daf: string
  hebrew: string[]
  english: string[]
  /** True when Sefaria marks the line's opening word with <big> (mishnah/gemara cue). */
  leadBig: boolean[]
  rashi: CommentaryNote[]
  tosafot: CommentaryNote[]
  einMishpat: GutterNote[]
  masoret: GutterNote[]
  /** True after commentary columns have been loaded. */
  commentariesReady?: boolean
}

const pageCache = new Map<string, GemaraPage>()
const inflight = new Map<string, Promise<GemaraPage>>()

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function hasLeadBig(html: string): boolean {
  return /<(?:big|strong)\b[^>]*>\s*<(?:big|strong)\b/i.test(html) ||
    /<big\b/i.test(html)
}

function asHebrewText(value: unknown): string {
  if (typeof value === 'string') return stripHtml(value)
  if (Array.isArray(value)) {
    return value.map((v) => asHebrewText(v)).filter(Boolean).join(' ')
  }
  return ''
}

export function normalizeDaf(input: string): string {
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, '')
  const match = cleaned.match(/^(\d+)([ab])?$/)
  if (!match) return '21a'
  return `${match[1]}${match[2] || 'a'}`
}

/** Turn the page: 21a → 21b → 22a. Clamped to Bava Metzia range 2a–119b. */
export function adjacentDaf(input: string, delta: -1 | 1): string {
  const current = normalizeDaf(input)
  const match = current.match(/^(\d+)([ab])$/)
  if (!match) return '21a'
  let num = Number(match[1])
  let side = match[2] as 'a' | 'b'
  if (delta === 1) {
    if (side === 'a') side = 'b'
    else {
      num += 1
      side = 'a'
    }
  } else if (side === 'b') {
    side = 'a'
  } else {
    num -= 1
    side = 'b'
  }
  if (num < 2) return '2a'
  if (num > 119) return '119b'
  return `${num}${side}`
}

export function buildBavaMetziaRef(daf: string): string {
  return `Bava_Metzia.${normalizeDaf(daf)}`
}

function isRashi(item: Record<string, unknown>): boolean {
  const collective = item.collectiveTitle as { en?: string } | undefined
  const index = String(item.index_title || '')
  return collective?.en === 'Rashi' || index.startsWith('Rashi on')
}

function isTosafot(item: Record<string, unknown>): boolean {
  const t = commentaryTitle(item)
  if (/Masoret HaTosefta/i.test(t)) return false
  return /Tosafot/i.test(t)
}

function commentaryTitle(item: Record<string, unknown>): string {
  const collective = item.collectiveTitle as { en?: string; he?: string } | undefined
  return String(collective?.en || item.index_title || '')
}

function mapNotes(
  items: Record<string, unknown>[],
  title: string,
): CommentaryNote[] {
  return items
    .map((item, i) => {
      const anchorVerse = Number(item.anchorVerse || 0)
      return {
        id: String(item.ref || `${title}-${anchorVerse}-${i}`),
        anchorVerse: Number.isFinite(anchorVerse) ? anchorVerse : 0,
        he: asHebrewText(item.he),
        en: asHebrewText(item.text),
        title,
      }
    })
    .filter((n) => n.he || n.en)
}

function mapGutter(items: Record<string, unknown>[]): GutterNote[] {
  return items
    .map((item, i) => {
      const heRef = String(item.heRef || '').trim()
      const ref = String(item.ref || '')
      const shortRef = ref.includes(',') ? ref.slice(ref.indexOf(',') + 1).trim() : ref
      const label = (heRef || shortRef).slice(0, 48)
      return {
        id: String(item.ref || `gutter-${i}`),
        he: label,
      }
    })
    .filter((n) => n.he)
    .slice(0, 18)
}

function isEinMishpat(item: Record<string, unknown>): boolean {
  const t = commentaryTitle(item)
  return /Ein Mishpat|Shulchan Arukh|Mishneh Torah|Tur\b/i.test(t)
}

function isMasoret(item: Record<string, unknown>): boolean {
  const t = commentaryTitle(item)
  return /Masoret HaShas|Mesoret HaShas|Masoret HaTosefta/i.test(t)
}

function parseTextPayload(data: Record<string, unknown>, daf: string): GemaraPage {
  const hebrewRaw: unknown[] = Array.isArray(data.he) ? data.he : []
  const englishRaw: unknown[] = Array.isArray(data.text) ? data.text : []
  const len = Math.max(hebrewRaw.length, englishRaw.length)
  const hebrew: string[] = []
  const english: string[] = []
  const leadBig: boolean[] = []
  for (let i = 0; i < len; i++) {
    const heHtml = String(hebrewRaw[i] ?? '')
    hebrew.push(stripHtml(heHtml))
    english.push(stripHtml(String(englishRaw[i] ?? '')))
    leadBig.push(hasLeadBig(heHtml))
  }

  const commentary = Array.isArray(data.commentary) ? data.commentary : []
  const hasCommentary = commentary.length > 0
  const rashi = mapNotes(
    commentary.filter((x: Record<string, unknown>) => isRashi(x)),
    'Rashi',
  )
  const tosafot = mapNotes(
    commentary.filter((x: Record<string, unknown>) => isTosafot(x)),
    'Tosafot',
  )
  const einMishpat = mapGutter(
    commentary.filter((x: Record<string, unknown>) => isEinMishpat(x)),
  )
  const masoret = mapGutter(
    commentary.filter((x: Record<string, unknown>) => isMasoret(x)),
  )
  const normalized = normalizeDaf(daf)

  return {
    ref: String(data.ref || `Bava Metzia ${normalized}`),
    heRef: String(data.heRef || ''),
    heIndexTitle: String(data.heIndexTitle || 'בבא מציעא'),
    daf: normalized,
    hebrew,
    english,
    leadBig,
    rashi,
    tosafot,
    einMishpat,
    masoret,
    commentariesReady: hasCommentary,
  }
}

async function fetchSefariaJson(daf: string, commentary: 0 | 1) {
  const ref = buildBavaMetziaRef(daf)
  const res = await fetch(
    `https://www.sefaria.org/api/texts/${ref}?context=0&commentary=${commentary}&ven=William_Davidson_Edition_-_English&vhe=William_Davidson_Edition_-_Vocalized_Aramaic`,
  )
  if (!res.ok) {
    throw new Error(`Could not load ${ref} from Sefaria (${res.status})`)
  }
  return (await res.json()) as Record<string, unknown>
}

/** Fast open: Gemara text only (~30KB). Commentaries load via enrichGemaraPage. */
export async function fetchGemaraPage(daf: string): Promise<GemaraPage> {
  const key = normalizeDaf(daf)
  const cached = pageCache.get(key)
  if (cached?.hebrew.length) return cached

  const existing = inflight.get(key)
  if (existing) return existing

  const promise = fetchSefariaJson(key, 0)
    .then((data) => {
      const page = parseTextPayload(data, key)
      pageCache.set(key, page)
      return page
    })
    .finally(() => {
      inflight.delete(key)
    })
  inflight.set(key, promise)
  return promise
}

/** Load Rashi / Tosafot / gutters after the amud is already on screen. */
export async function enrichGemaraPage(page: GemaraPage): Promise<GemaraPage> {
  if (page.commentariesReady) return page
  const key = normalizeDaf(page.daf)
  try {
    const data = await fetchSefariaJson(key, 1)
    const full = parseTextPayload(data, key)
    const merged: GemaraPage = {
      ...page,
      ...full,
      hebrew: page.hebrew.length ? page.hebrew : full.hebrew,
      english: page.english.length ? page.english : full.english,
      leadBig: page.leadBig.length ? page.leadBig : full.leadBig,
      commentariesReady: true,
    }
    pageCache.set(key, merged)
    return merged
  } catch {
    return { ...page, commentariesReady: true }
  }
}

/** Warm the next/previous amud in the background. */
export function prefetchGemaraPage(daf: string): void {
  const key = normalizeDaf(daf)
  if (pageCache.has(key) || inflight.has(key)) return
  void fetchGemaraPage(key).then((page) => {
    void enrichGemaraPage(page)
  })
}

export function notesForLine(
  notes: CommentaryNote[],
  lineIndex: number,
): CommentaryNote[] {
  // Sefaria anchorVerse is 1-based segment index
  return notes.filter((n) => n.anchorVerse === lineIndex + 1)
}

export function isMishnahLine(english: string, hebrew: string): boolean {
  return (
    /mishna/i.test(english) ||
    /מתני['׳']/.test(hebrew) ||
    hebrew.includes('מַתְנִי')
  )
}

export function isGemaraMarker(english: string, hebrew: string): boolean {
  return /gemara/i.test(english) || /גמ['׳']/.test(hebrew) || hebrew.includes('גְּמָ')
}

/** Best starting line for Hashavas Aveidah on 21a (Mishna Eilu Metziot). */
export function defaultStartIndex(daf: string, english: string[]): number {
  if (normalizeDaf(daf) !== '21a') return 0
  const idx = english.findIndex((line) =>
    /mishna/i.test(line) && /found items|lost items|eilu|which found/i.test(line),
  )
  return idx >= 0 ? idx : 6
}
