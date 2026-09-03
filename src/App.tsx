import { useEffect, useState } from 'react'
import { Home } from './components/Home'
import { LearningRoom } from './components/LearningRoom'
import { Onboarding } from './components/Onboarding'
import { AuthScreen } from './components/AuthScreen'
import { AdminPanel } from './components/AdminPanel'
import { TestingPanel } from './components/TestingPanel'
import { SupportForm } from './components/SupportForm'
import { RabbiPanel } from './components/RabbiPanel'
import { RabbiRequestScreen } from './components/RabbiRequestScreen'
import { ApplicationSubmitted } from './components/ApplicationSubmitted'
import {
  APP_NAME,
  hasCompletedOnboarding,
  markOnboardingDone,
  REBBE_VOICES,
  type TalkMode,
} from './lib/brand'
import {
  fetchMe,
  getToken,
  isApprovedRabbi,
  logout,
  type Account,
} from './lib/account'
import './index.css'

type Session = {
  daf: string
  voiceId: string
  tractateId: string
  talkMode: TalkMode
} | null

type View =
  | 'home'
  | 'learn'
  | 'auth'
  | 'auth-rabbi'
  | 'admin'
  | 'testing'
  | 'rabbi'
  | 'rebbe-request'
  | 'rebbe-pending'

function viewFromPath(): View {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/admin') return 'admin'
  if (path === '/test' || path === '/testing') return 'testing'
  if (path === '/rebbi' || path === '/rebbe' || path === '/rabbi') return 'rabbi'
  if (
    path === '/learn-with-rebbi' ||
    path === '/learn-with-rebbe'
  ) {
    return 'rebbe-request'
  }
  if (
    path === '/register-rebbi' ||
    path === '/register-rebbe' ||
    path === '/register-rabbi'
  ) {
    return 'auth-rabbi'
  }
  if (
    path === '/application-submitted' ||
    path === '/rebbi-pending' ||
    path === '/rebbe-pending' ||
    path === '/rabbi-pending'
  ) {
    return 'rebbe-pending'
  }
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
          : next === 'rabbi'
            ? '/rebbi'
            : next === 'rebbe-request'
              ? '/learn-with-rebbi'
              : next === 'rebbe-pending'
                ? '/application-submitted'
                : next === 'auth-rabbi'
                  ? '/register-rebbi'
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

  useEffect(() => {
    if (!authReady || !account) return
    if (view === 'rebbe-pending' && isApprovedRabbi(account)) {
      go('rabbi')
      return
    }
    if (view === 'rebbe-pending' && account.rabbiStatus !== 'pending') {
      go('home')
    }
  }, [authReady, account, view])

  function finishOnboarding() {
    markOnboardingDone()
    setShowOnboarding(false)
  }

  function routeAfterSignIn(acc: Account) {
    setAccount(acc)
    if (acc.role === 'admin') go('admin')
    else if (isApprovedRabbi(acc)) go('rabbi')
    else if (acc.rabbiStatus === 'pending') go('rebbe-pending')
    else if (acc.role === 'tester') go('testing')
    else go('home')
  }

  async function signOutAndHome() {
    await logout()
    setAccount(null)
    go('home')
  }

  if (!authReady) {
    return (
      <div className="shell home-shell">
        <p className="soft">Loading…</p>
      </div>
    )
  }

  if (view === 'auth' || view === 'auth-rabbi') {
    return (
      <AuthScreen
        initialMode={view === 'auth-rabbi' ? 'rabbi' : 'login'}
        onBack={() => go('home')}
        onSignedIn={routeAfterSignIn}
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

  if (view === 'rebbe-pending') {
    if (!account) {
      return (
        <AuthScreen
          onBack={() => go('home')}
          onSignedIn={routeAfterSignIn}
        />
      )
    }
    if (isApprovedRabbi(account)) {
      return (
        <div className="shell home-shell">
          <p className="soft">Opening your teaching desk…</p>
        </div>
      )
    }
    if (account.rabbiStatus !== 'pending') {
      return (
        <div className="shell home-shell">
          <p className="soft">Redirecting…</p>
        </div>
      )
    }
    return (
      <ApplicationSubmitted
        account={account}
        onContinueLearning={() => go('home')}
        onSignOut={() => void signOutAndHome()}
      />
    )
  }

  if (view === 'rabbi') {
    if (!account) {
      return (
        <AuthScreen
          onBack={() => go('home')}
          onSignedIn={routeAfterSignIn}
        />
      )
    }
    if (account.rabbiStatus === 'pending') {
      return (
        <ApplicationSubmitted
          account={account}
          onContinueLearning={() => go('home')}
          onSignOut={() => void signOutAndHome()}
        />
      )
    }
    if (!isApprovedRabbi(account)) {
      return (
        <div className="shell home-shell">
          <main className="home auth-home">
            <p className="brand">{APP_NAME}</p>
            <h1>Teaching desk</h1>
            <p className="lede">
              Your Rebbi application still needs to be approved before you can
              take students.
            </p>
            <div className="submitted-actions">
              <button type="button" className="btn-main" onClick={() => go('home')}>
                Back to Guide
              </button>
            </div>
          </main>
        </div>
      )
    }
    return <RabbiPanel account={account} onBack={() => go('home')} />
  }

  if (view === 'rebbe-request') {
    if (!account) {
      return (
        <AuthScreen
          onBack={() => go('home')}
          onSignedIn={(acc) => {
            setAccount(acc)
            go('rebbe-request')
          }}
        />
      )
    }
    return (
      <RabbiRequestScreen
        account={account}
        onBack={() => go('home')}
        onLearnWithGuide={() => go('home')}
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
        talkMode={session.talkMode}
        onVoiceIdChange={(voiceId) =>
          setSession((prev) => (prev ? { ...prev, voiceId } : prev))
        }
        onTalkModeChange={(talkMode) =>
          setSession((prev) => (prev ? { ...prev, talkMode } : prev))
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
        onStart={({ daf, voiceId, tractateId, talkMode }) => {
          setSession({ daf, voiceId, tractateId, talkMode })
        }}
        onLearnWithRebbi={() => {
          if (!account) {
            go('auth')
            return
          }
          go('rebbe-request')
        }}
        onShowTour={() => setShowOnboarding(true)}
        onSignIn={() => go('auth')}
        onRegisterRabbi={() =>
          go(account?.rabbiStatus === 'pending' ? 'rebbe-pending' : 'auth-rabbi')
        }
        onOpenPendingApplication={
          account?.rabbiStatus === 'pending'
            ? () => go('rebbe-pending')
            : undefined
        }
        onSignOut={() => void signOutAndHome()}
        onOpenAdmin={() => go('admin')}
        onOpenTesting={() => go('testing')}
        onOpenRabbiPanel={() => go('rabbi')}
        onOpenSupport={() => setShowSupport(true)}
      />
      {showSupport && (
        <SupportForm
          defaultName={account?.username}
          defaultPhone=""
          onClose={() => setShowSupport(false)}
        />
      )}
    </>
  )
}
