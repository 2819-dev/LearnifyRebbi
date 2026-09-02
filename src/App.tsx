import { useState } from 'react'
import { Home } from './components/Home'
import { LearningRoom } from './components/LearningRoom'
import { REBBE_VOICES } from './lib/brand'
import './index.css'

type Session = {
  daf: string
  voiceId: string
} | null

export default function App() {
  const [session, setSession] = useState<Session>(null)

  if (!session) {
    return (
      <Home
        onStart={({ daf, voiceId }) => setSession({ daf, voiceId })}
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
    />
  )
}
