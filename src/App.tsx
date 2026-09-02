import { useEffect, useState } from 'react'
import { Home } from './components/Home'
import { LearningRoom } from './components/LearningRoom'
import { Onboarding } from './components/Onboarding'
import { AuthScreen } from './components/AuthScreen'
import { AdminPanel } from './components/AdminPanel'
import { TestingPanel } from './components/TestingPanel'
import { SupportForm } from './components/SupportForm'
import {
  hasCompletedOnboarding,
  markOnboardingDone,
  REBBE_VOICES,
} from './lib/brand'
import {
  fetchMe,
  getToken,
  logout,
  type Account,
} from './lib/account'
import './index.css'

type Session = {
  daf: string
  voiceId: string
  tractateId: string
} | null

type View = 'home' | 'learn' | 'auth' | 'admin' | 'testing'

function viewFromPath(): View {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/admin') return 'admin'
  if (path === '/test' || path === '/testing') return 'testing'
  if (path === '/login' || path === '/account') return 'auth'
  return 'home'
}

export default function App() {
  const [view, setView] = useState<View>(() => viewFromPath())
  const [session, setSession] = useState<Session>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [authReady, setAuthReady] = useState(!getToken())
  const [showOnboarding, setShowOnboarding] = useState(
    () => !hasCompletedOnboarding(),
  )
  const [showSupport, setShowSupport] = useState(false)

  function go(next: View) {
    setView(next)
    const path =
      next === 'admin'
        ? '/admin'
        : next === 'testing'
          ? '/test'
          : next === 'auth'
            ? '/login'
            : '/'
    window.history.pushState({}, '', path)
  }

  useEffect(() => {
    const onPop = () => setView(viewFromPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!getToken()) {
      setAuthReady(true)
      return
    }
    fetchMe()
      .then((me) => {
        if (!cancelled) setAccount(me)
      })
      .catch(() => {
        if (!cancelled) setAccount(null)
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function finishOnboarding() {
    markOnboardingDone()
    setShowOnboarding(false)
  }

  if (!authReady) {
    return (
      <div className="shell home-shell">
        <p className="soft">Loading…</p>
      </div>
    )
  }

  if (view === 'auth') {
    return (
      <AuthScreen
        onBack={() => go('home')}
        onSignedIn={(acc) => {
          setAccount(acc)
          if (acc.role === 'admin') go('admin')
          else if (acc.role === 'tester') go('testing')
          else go('home')
        }}
      />
    )
  }

  if (view === 'admin') {
    if (!account) {
      return (
        <AuthScreen
          onBack={() => go('home')}
          onSignedIn={(acc) => {
            setAccount(acc)
            go(acc.role === 'admin' ? 'admin' : 'home')
          }}
        />
      )
    }
    if (account.role !== 'admin') {
      return (
        <div className="shell home-shell">
          <main className="home">
            <h1>Admin only</h1>
            <p className="lede">Your account does not have admin access.</p>
            <button type="button" className="btn-main" onClick={() => go('home')}>
              Back
            </button>
          </main>
        </div>
      )
    }
    return (
      <AdminPanel
        account={account}
        onBack={() => go('home')}
        onOpenTesting={() => go('testing')}
      />
    )
  }

  if (view === 'testing') {
    if (!account) {
      return (
        <AuthScreen
          onBack={() => go('home')}
          onSignedIn={(acc) => {
            setAccount(acc)
            go(
              acc.role === 'tester' || acc.role === 'admin' ? 'testing' : 'home',
            )
          }}
        />
      )
    }
    if (account.role !== 'tester' && account.role !== 'admin') {
      return (
        <div className="shell home-shell">
          <main className="home">
            <h1>Testing panel</h1>
            <p className="lede">
              An admin needs to grant you tester access first.
            </p>
            <button type="button" className="btn-main" onClick={() => go('home')}>
              Back
            </button>
          </main>
        </div>
      )
    }
    return (
      <TestingPanel
        account={account}
        onBack={() => go('home')}
        onOpenAdmin={
          account.role === 'admin' ? () => go('admin') : undefined
        }
      />
    )
  }

  if (showOnboarding) {
    return <Onboarding onDone={finishOnboarding} />
  }

  if (session) {
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

  return (
    <>
      <Home
        account={account}
        onStart={({ daf, voiceId, tractateId }) => {
          setSession({ daf, voiceId, tractateId })
        }}
        onShowTour={() => setShowOnboarding(true)}
        onSignIn={() => go('auth')}
        onSignOut={async () => {
          await logout()
          setAccount(null)
        }}
        onOpenAdmin={() => go('admin')}
        onOpenTesting={() => go('testing')}
        onOpenSupport={() => setShowSupport(true)}
      />
      {showSupport && (
        <SupportForm
          defaultName={account?.username}
          defaultPhone={account?.phone}
          onClose={() => setShowSupport(false)}
        />
      )}
    </>
  )
}
