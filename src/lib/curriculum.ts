export type TractateOption = {
  id: string
  label: string
  masechta: string
  topic: string
  defaultDaf: string
  enabled: boolean
}

export const TRACTATES: TractateOption[] = [
  {
    id: 'bm-hashavas',
    label: 'Bava Metzia · Hashavas Aveidah',
    masechta: 'Bava Metzia',
    topic: 'Hashavas Aveidah',
    defaultDaf: '21a',
    enabled: true,
  },
  {
    id: 'bm-hamafkid',
    label: 'Bava Metzia · Hamafkid',
    masechta: 'Bava Metzia',
    topic: 'Hamafkid',
    defaultDaf: '33b',
    enabled: false,
  },
  {
    id: 'berachot',
    label: 'Berachot',
    masechta: 'Berachot',
    topic: 'Coming soon',
    defaultDaf: '2a',
    enabled: false,
  },
]

export const HIGHLIGHT_LEGEND = [
  {
    id: 'reading',
    label: 'Being read',
    swatch: '#2a6ea8',
    meaning: 'The words the Rebbe is reading right now.',
  },
  {
    id: 'term',
    label: 'Key term',
    swatch: '#154455',
    meaning: 'An important word he is explaining, like siman or ye’ush.',
  },
  {
    id: 'rashi',
    label: 'Rashi',
    swatch: '#2f6b4f',
    meaning: 'A place he wants you to look at in Rashi.',
  },
  {
    id: 'focus',
    label: 'Pay attention',
    swatch: '#b85a3a',
    meaning: 'A detail that decides the din.',
  },
] as const

export type HighlightKind = (typeof HIGHLIGHT_LEGEND)[number]['id']

/** Hebrew / transliteration tokens used for local highlight fallbacks. */
export const HIGHLIGHT_TERM_HINTS = [
  'סימן',
  'יאוש',
  'הפקר',
  'מכריז',
  'אבידה',
  'מציאה',
  'מעות',
  'פירות',
  'siman',
  "ye'ush",
  'yeush',
  'hefker',
]
