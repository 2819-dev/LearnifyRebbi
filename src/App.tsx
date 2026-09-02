import { useState } from 'react'
import { Home } from './components/Home'
import { LearningRoom } from './components/LearningRoom'
import { Onboarding } from './components/Onboarding'
import {
  hasCompletedOnboarding,
  markOnboardingDone,
  REBBE_VOICES,
} from './lib/brand'
import './index.css'

type Session = {
  daf: string
  voiceId: string
  tractateId: string
} | null

export default function App() {
  const [session, setSession] = useState<Session>(null)
  const [showOnboarding, setShowOnboarding] = useState(
    () => !hasCompletedOnboarding(),
  )

  function finishOnboarding() {
    markOnboardingDone()
    setShowOnboarding(false)
  }

  if (showOnboarding) {
    return <Onboarding onDone={finishOnboarding} />
  }

  if (!session) {
    return (
      <Home
        onStart={({ daf, voiceId, tractateId }) =>
          setSession({ daf, voiceId, tractateId })
        }
        onShowTour={() => setShowOnboarding(true)}
      />
    )
  }

  return (
    <LearningRoom
      daf={session.daf}
      voiceId={session.voiceId || REBBE_VOICES[0].id}
      onVoiceIdChange={(voiceId) =>
        setSession((prev) => (prev ? { ...prev, voiceId } : prev))
      }
      onExit={() => setSession(null)}
      onShowTour={() => setShowOnboarding(true)}
    />
  )
}
