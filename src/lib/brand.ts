export const APP_NAME = 'Guide'

export const ONBOARDING_KEY = 'guide.onboarding.v1'
export const TALK_MODE_KEY = 'guide.talkMode.v1'

export type TalkMode = 'voice' | 'text'

export function loadTalkMode(): TalkMode {
  try {
    return localStorage.getItem(TALK_MODE_KEY) === 'text' ? 'text' : 'voice'
  } catch {
    return 'voice'
  }
}

export function saveTalkMode(mode: TalkMode) {
  try {
    localStorage.setItem(TALK_MODE_KEY, mode)
  } catch {
    // ignore
  }
}

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
    id: 'Charon',
    label: 'Teacher',
    blurb: 'Warm professional man.',
  },
  {
    id: 'Sadaltager',
    label: 'Steady',
    blurb: 'Clear and knowledgeable.',
  },
  {
    id: 'Schedar',
    label: 'Even',
    blurb: 'Calm and measured.',
  },
  {
    id: 'Gacrux',
    label: 'Warm',
    blurb: 'Gentle pacing.',
  },
] as const

export type RebbeVoiceId = (typeof REBBE_VOICES)[number]['id']
