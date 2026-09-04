export const APP_NAME = 'Guide'

export const ONBOARDING_KEY = 'guide.onboarding.v1'
export const TALK_MODE_KEY = 'guide.talkMode.v1'
export const LEARNING_PREFS_KEY = 'guide.learningPrefs.v1'
export const LEARNING_PROGRESS_KEY = 'guide.learningProgress.v1'

export type TalkMode = 'voice' | 'text'

export type LearningPrefs = {
  tractateId: string
  daf: string
  voiceId: string
  talkMode: TalkMode
}

export type LearningProgress = {
  tractateId: string
  daf: string
  lineIndex: number
  voiceId: string
  talkMode: TalkMode
  updatedAt: string
}

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

export function loadLearningPrefs(): Partial<LearningPrefs> {
  try {
    const raw = localStorage.getItem(LEARNING_PREFS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<LearningPrefs>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveLearningPrefs(prefs: LearningPrefs) {
  try {
    localStorage.setItem(LEARNING_PREFS_KEY, JSON.stringify(prefs))
    localStorage.setItem(TALK_MODE_KEY, prefs.talkMode)
  } catch {
    // ignore
  }
}

export function loadLearningProgress(): LearningProgress | null {
  try {
    const raw = localStorage.getItem(LEARNING_PROGRESS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LearningProgress
    if (!parsed?.daf || typeof parsed.lineIndex !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function saveLearningProgress(progress: LearningProgress) {
  try {
    localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(progress))
    saveLearningPrefs({
      tractateId: progress.tractateId,
      daf: progress.daf,
      voiceId: progress.voiceId,
      talkMode: progress.talkMode,
    })
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
