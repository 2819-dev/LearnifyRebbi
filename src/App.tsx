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
import { ApplicationRejected } from './components/ApplicationRejected'
import { AppMark } from './components/AppMark'
import {
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
  lineIndex?: number
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
  | 'rebbe-rejected'

type AuthMode = 'login' | 'register' | 'rabbi' | 'apply'
type ResumeView = 'home' | 'rebbe-request' | 'rabbi' | 'auth-rabbi'

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
  if (
    path === '/application-update' ||
    path === '/application-rejected'
  ) {
    return 'rebbe-rejected'
  }
  if (path === '/login' || path === '/account') return 'auth'
  return 'home'
}

function pathForView(next: View): string {
  if (next === 'admin') return '/admin'
  if (next === 'testing') return '/test'
  if (next === 'rabbi') return '/rebbi'
  if (next === 'rebbe-request') return '/learn-with-rebbi'
  if (next === 'rebbe-pending') return '/application-submitted'
  if (next === 'rebbe-rejected') return '/application-update'
  if (next === 'auth-rabbi') return '/register-rebbi'
  if (next === 'auth') return '/login'
  return '/'
}

export default function App() {
  const [view, setView] = useState<View>(() => viewFromPath())
  const [session, setSession] = useState<Session>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [authReady, setAuthReady] = useState(!getToken())
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [resumeAfterAuth, setResumeAfterAuth] = useState<ResumeView>('home')
  const [showOnboarding, setShowOnboarding] = useState(
    () => !hasCompletedOnboarding(),
  )
  const [showSupport, setShowSupport] = useState(false)

  function go(next: View) {
    setView(next)
    window.history.pushState({}, '', pathForView(next))
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
    if (view === 'rebbe-pending' && account.rabbiStatus === 'rejected') {
      go('rebbe-rejected')
      return
    }
    if (
      view === 'rebbe-pending' &&
      account.rabbiStatus !== 'pending'
    ) {
      go('home')
      return
    }
    if (
      view === 'auth-rabbi' &&
      account.rabbiStatus === 'pending'
    ) {
      go('rebbe-pending')
    }
  }, [authReady, account, view])

  function finishOnboarding() {
    markOnboardingDone()
    setShowOnboarding(false)
  }

  function openAuth(mode: AuthMode, resume: ResumeView = 'home') {
    setAuthMode(mode)
    setResumeAfterAuth(resume)
    go(mode === 'rabbi' || mode === 'apply' ? 'auth-rabbi' : 'auth')
  }

  function routeAfterSignIn(acc: Account) {
    setAccount(acc)
    const resume = resumeAfterAuth
    setResumeAfterAuth('home')
    setAuthMode('login')

    if (acc.rabbiStatus === 'pending' && (resume === 'auth-rabbi' || view === 'auth-rabbi')) {
      go('rebbe-pending')
      return
    }
    if (resume === 'rebbe-request') {
      go('rebbe-request')
      return
    }
    if (resume === 'rabbi') {
      if (isApprovedRabbi(acc)) {
        go('rabbi')
        return
      }
      if (acc.rabbiStatus === 'pending') {
        go('rebbe-pending')
        return
      }
      if (acc.rabbiStatus === 'rejected') {
        go('rebbe-rejected')
        return
      }
    }
    if (resume === 'auth-rabbi') {
      if (isApprovedRabbi(acc)) {
        go('rabbi')
        return
      }
      if (acc.rabbiStatus === 'pending') {
        go('rebbe-pending')
        return
      }
      if (acc.rabbiStatus === 'rejected') {
        go('rebbe-rejected')
        return
      }
      // Signed-in student who landed on Become a Rebbi after login
      if (getToken() && acc.rabbiStatus !== 'approved') {
        openAuth('apply', 'auth-rabbi')
        return
      }
    }

    if (acc.role === 'admin') go('admin')
    else if (isApprovedRabbi(acc)) go('rabbi')
    else if (acc.rabbiStatus === 'pending') go('rebbe-pending')
    else if (acc.role === 'tester') go('testing')
    else go('home')
  }

  function openBecomeRabbi() {
    if (!account) {
      openAuth('rabbi', 'auth-rabbi')
      return
    }
    if (isApprovedRabbi(account)) {
      go('rabbi')
      return
    }
    if (account.rabbiStatus === 'pending') {
      go('rebbe-pending')
      return
    }
    if (account.rabbiStatus === 'rejected') {
      go('rebbe-rejected')
      return
    }
    openAuth('apply', 'auth-rabbi')
  }

  function openLearnWithRebbi() {
    if (!account) {
      openAuth('login', 'rebbe-request')
      return
    }
    go('rebbe-request')
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
    let mode: AuthMode = 'login'
    if (view === 'auth-rabbi') {
      if (
        account &&
        !isApprovedRabbi(account) &&
        account.rabbiStatus !== 'pending'
      ) {
        mode = 'apply'
      } else if (authMode === 'apply') {
        mode = 'apply'
      } else {
        mode = 'rabbi'
      }
    } else if (authMode === 'register') {
      mode = 'register'
    }

    if (account?.rabbiStatus === 'pending' && view === 'auth-rabbi') {
      return (
        <div className="shell home-shell">
          <p className="soft">Opening your application…</p>
        </div>
      )
    }

    return (
      <AuthScreen
        key={`${view}-${mode}-${account?.id || 'guest'}`}
        initialMode={mode}
        signedInAccount={account}
        onBack={() => {
          setResumeAfterAuth('home')
          go('home')
        }}
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
            <h1>Private area</h1>
            <p className="lede">This page is only for Guide owners.</p>
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

  if (view === 'rebbe-rejected') {
    if (!account) {
      return (
        <AuthScreen
          onBack={() => go('home')}
          onSignedIn={routeAfterSignIn}
        />
      )
    }
    return (
      <ApplicationRejected
        account={account}
        onContinueLearning={() => go('home')}
        onReapply={() => openAuth('apply', 'auth-rabbi')}
        onSignOut={() => void signOutAndHome()}
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
    if (account.rabbiStatus === 'rejected') {
      return (
        <div className="shell home-shell">
          <p className="soft">Opening your application update…</p>
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
          onSignedIn={(acc) => {
            setAccount(acc)
            setResumeAfterAuth('rabbi')
            routeAfterSignIn(acc)
          }}
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
    if (account.rabbiStatus === 'rejected') {
      return (
        <ApplicationRejected
          account={account}
          onContinueLearning={() => go('home')}
          onReapply={() => openAuth('apply', 'auth-rabbi')}
          onSignOut={() => void signOutAndHome()}
        />
      )
    }
    if (!isApprovedRabbi(account)) {
      return (
        <div className="shell home-shell">
          <main className="home auth-home">
            <p className="brand-mark">
              <AppMark size="md" />
            </p>
            <h1>Teaching desk</h1>
            <p className="lede">
              Apply to teach as a Rebbi to open this desk and meet students.
            </p>
            <div className="submitted-actions">
              <button
                type="button"
                className="btn-main"
                onClick={() => openBecomeRabbi()}
              >
                Become a Rebbi
              </button>
              <button type="button" className="btn-main btn-secondary" onClick={() => go('home')}>
                Back home
              </button>
            </div>
          </main>
        </div>
      )
    }
    return <RabbiPanel account={account} onBack={() => go('home')} onAccountChange={setAccount} />
  }

  if (view === 'rebbe-request') {
    if (!account) {
      return (
        <AuthScreen
          onBack={() => go('home')}
          onSignedIn={(acc) => {
            setAccount(acc)
            setResumeAfterAuth('rebbe-request')
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
            <h1>Coaching desk</h1>
            <p className="lede">
              Ask Guide for access if you help improve how the Rebbi teaches.
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
      <>
        <LearningRoom
          daf={session.daf}
          tractateId={session.tractateId}
          voiceId={session.voiceId || REBBE_VOICES[0].id}
          talkMode={session.talkMode}
          startLineIndex={session.lineIndex}
          onVoiceIdChange={(voiceId) =>
            setSession((prev) => (prev ? { ...prev, voiceId } : prev))
          }
          onTalkModeChange={(talkMode) =>
            setSession((prev) => (prev ? { ...prev, talkMode } : prev))
          }
          onDafChange={(daf) =>
            setSession((prev) =>
              prev ? { ...prev, daf, lineIndex: undefined } : prev,
            )
          }
          onExit={() => setSession(null)}
          onShowTour={() => setShowOnboarding(true)}
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

  return (
    <>
      <Home
        account={account}
        onStart={({ daf, voiceId, tractateId, talkMode, lineIndex }) => {
          setSession({ daf, voiceId, tractateId, talkMode, lineIndex })
        }}
        onLearnWithRebbi={openLearnWithRebbi}
        onShowTour={() => setShowOnboarding(true)}
        onSignIn={() => openAuth('login', 'home')}
        onRegisterRabbi={openBecomeRabbi}
        onOpenPendingApplication={
          account?.rabbiStatus === 'pending'
            ? () => go('rebbe-pending')
            : account?.rabbiStatus === 'rejected'
              ? () => go('rebbe-rejected')
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
