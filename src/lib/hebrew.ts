/** Hebrew numerals with geresh / gershayim, including טו/טז. */
export function toHebrewNumeral(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n === 15) return 'ט״ו'
  if (n === 16) return 'ט״ז'
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק']
  let value = Math.floor(n)
  let out = ''
  while (value >= 400) {
    out += 'ת'
    value -= 400
  }
  out += hundreds[Math.floor(value / 100)] || ''
  value %= 100
  if (value === 15) out += 'טו'
  else if (value === 16) out += 'טז'
  else {
    out += tens[Math.floor(value / 10)] || ''
    out += ones[value % 10] || ''
  }
  if (out.length === 1) return `${out}׳`
  return `${out.slice(0, -1)}״${out.slice(-1)}`
}

export function parseDafParts(daf: string): { num: number; amud: 'a' | 'b' } {
  const cleaned = daf.trim().toLowerCase().replace(/\s+/g, '')
  const match = cleaned.match(/^(\d+)([ab])?$/)
  return {
    num: match ? Number(match[1]) : 0,
    amud: match?.[2] === 'b' ? 'b' : 'a',
  }
}

export function formatAmudHe(daf: string): { dafHe: string; amudHe: string } {
  const { num, amud } = parseDafParts(daf)
  return {
    dafHe: toHebrewNumeral(num),
    amudHe: amud === 'b' ? 'ע״ב' : 'ע״א',
  }
}

const BM_PERAKIM: { from: number; ordinalHe: string; nameHe: string }[] = [
  { from: 2, ordinalHe: 'ראשון', nameHe: 'שנים אוחזין' },
  { from: 21, ordinalHe: 'שני', nameHe: 'אלו מציאות' },
  { from: 33.5, ordinalHe: 'שלישי', nameHe: 'המפקיד' },
  { from: 44, ordinalHe: 'רביעי', nameHe: 'הזהב' },
  { from: 60.5, ordinalHe: 'חמישי', nameHe: 'איזהו נשך' },
  { from: 75.5, ordinalHe: 'ששי', nameHe: 'השוכר את האומנין' },
  { from: 83, ordinalHe: 'שביעי', nameHe: 'השוכר את הפועלים' },
  { from: 93.5, ordinalHe: 'שמיני', nameHe: 'השואל' },
  { from: 104, ordinalHe: 'תשיעי', nameHe: 'המקבל שדה מחברו' },
  { from: 116.5, ordinalHe: 'עשירי', nameHe: 'הבית והעליה' },
]

export function bavaMetziaPerek(daf: string): {
  ordinalHe: string
  nameHe: string
} {
  const { num, amud } = parseDafParts(daf)
  const key = num + (amud === 'b' ? 0.5 : 0)
  let found = BM_PERAKIM[0]
  for (const p of BM_PERAKIM) {
    if (key >= p.from) found = p
  }
  return found
}

/** Lead words of a Rashi/Tosafot in square script; rest in Rashi script. */
export function splitDibbur(he: string): { lemma: string; body: string } {
  const trimmed = he.replace(/\s+/g, ' ').trim()
  if (!trimmed) return { lemma: '', body: '' }
  const dashed = trimmed.match(/^(.{2,56}?)(?:\s+[—\-–:]\s+|\s+[-–]\s+)(.+)$/)
  if (dashed) return { lemma: dashed[1].trim(), body: dashed[2].trim() }
  const words = trimmed.split(' ')
  const n = words.length > 10 ? 3 : Math.min(2, words.length)
  return { lemma: words.slice(0, n).join(' '), body: words.slice(n).join(' ') }
}
