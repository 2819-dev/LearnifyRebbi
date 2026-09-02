export const APP_NAME = 'Guide'

export const REBBE_VOICES = [
  {
    id: 'Sadaltager',
    label: 'Steady',
    blurb: 'Clear and knowledgeable.',
  },
  {
    id: 'Charon',
    label: 'Patient',
    blurb: 'Calm and careful.',
  },
  {
    id: 'Gacrux',
    label: 'Warm',
    blurb: 'Gentle and mature.',
  },
  {
    id: 'Schedar',
    label: 'Even',
    blurb: 'Steady pacing.',
  },
] as const

export type RebbeVoiceId = (typeof REBBE_VOICES)[number]['id']
