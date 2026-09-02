export const APP_NAME = 'Guide'

export const REBBE_VOICES = [
  {
    id: 'Sadaltager',
    label: 'Steady Rebbe',
    blurb: 'Clear and knowledgeable — great for class.',
  },
  {
    id: 'Charon',
    label: 'Patient Rebbe',
    blurb: 'Calm and informative.',
  },
  {
    id: 'Gacrux',
    label: 'Warm Rebbe',
    blurb: 'Mature, gentle classroom tone.',
  },
  {
    id: 'Schedar',
    label: 'Even Rebbe',
    blurb: 'Steady pacing, easy to follow.',
  },
  {
    id: 'Alnilam',
    label: 'Firm Rebbe',
    blurb: 'Confident and focused.',
  },
] as const

export type RebbeVoiceId = (typeof REBBE_VOICES)[number]['id']
