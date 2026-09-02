export const APP_NAME = 'Guide'

export const ONBOARDING_KEY = 'guide.onboarding.v1'

export function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1'
  } catch {
    return false
  }
}

export function markOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1')
  } catch {
    // ignore
  }
}

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
