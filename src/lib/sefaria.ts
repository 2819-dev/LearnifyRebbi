export type GemaraPage = {
  ref: string
  heRef: string
  hebrew: string[]
  english: string[]
}

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

export function normalizeDaf(input: string): string {
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, '')
  const match = cleaned.match(/^(\d+)([ab])?$/)
  if (!match) return '21a'
  return `${match[1]}${match[2] || 'a'}`
}

export function buildBavaMetziaRef(daf: string): string {
  return `Bava_Metzia.${normalizeDaf(daf)}`
}

export async function fetchGemaraPage(daf: string): Promise<GemaraPage> {
  const ref = buildBavaMetziaRef(daf)
  const res = await fetch(
    `https://www.sefaria.org/api/texts/${ref}?context=0&commentary=0`,
  )
  if (!res.ok) {
    throw new Error(`Could not load ${ref} from Sefaria (${res.status})`)
  }
  const data = await res.json()
  const hebrewRaw: unknown[] = Array.isArray(data.he) ? data.he : []
  const englishRaw: unknown[] = Array.isArray(data.text) ? data.text : []
  const len = Math.max(hebrewRaw.length, englishRaw.length)
  const hebrew: string[] = []
  const english: string[] = []
  for (let i = 0; i < len; i++) {
    hebrew.push(stripHtml(String(hebrewRaw[i] ?? '')))
    english.push(stripHtml(String(englishRaw[i] ?? '')))
  }
  return {
    ref: data.ref || `Bava Metzia ${normalizeDaf(daf)}`,
    heRef: data.heRef || '',
    hebrew,
    english,
  }
}

/** Best starting line for Hashavas Aveidah on 21a (Mishna Eilu Metziot). */
export function defaultStartIndex(daf: string, english: string[]): number {
  if (normalizeDaf(daf) !== '21a') return 0
  const idx = english.findIndex((line) =>
    /mishna/i.test(line) && /found items|lost items|eilu|which found/i.test(line),
  )
  return idx >= 0 ? idx : 6
}
