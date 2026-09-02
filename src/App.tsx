import { useState } from 'react'
import { Home } from './components/Home'
import { LearningRoom } from './components/LearningRoom'
import './index.css'

type Session = {
  daf: string
  voiceId: string | null
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
      voiceId={session.voiceId}
      onVoiceIdChange={(voiceId) =>
        setSession((prev) => (prev ? { ...prev, voiceId } : prev))
      }
      onExit={() => setSession(null)}
    />
  )
}
