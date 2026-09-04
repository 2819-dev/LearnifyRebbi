import { useState } from 'react'
import { AppMark } from './AppMark'
import {
  applyAsRabbi,
  login,
  register,
  registerRabbi,
  type Account,
  type RabbiAnswers,
} from '../lib/account'

type Mode = 'login' | 'register' | 'rabbi' | 'apply'

type Props = {
  onSignedIn: (account: Account) => void
  onBack: () => void
  initialMode?: Mode
  signedInAccount?: Account | null
}

const EMPTY_ANSWERS: RabbiAnswers = {
  displayName: '',
  experience: '',
  ages: '',
  availability: '',
  approach: '',
  why: '',
}

export function AuthScreen({
  onSignedIn,
  onBack,
  initialMode = 'login',
  signedInAccount = null,
}: Props) {
  const [mode, setMode] = useState<Mode>(
    signedInAccount && (initialMode === 'rabbi' || initialMode === 'apply')
      ? 'apply'
      : initialMode,
  )
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [answers, setAnswers] = useState<RabbiAnswers>(EMPTY_ANSWERS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRabbiFlow = mode === 'rabbi' || mode === 'apply'
  const isApplyOnly = mode === 'apply'
  const title =
    mode === 'login'
      ? 'Sign in'
      : isRabbiFlow
        ? 'Become a Rebbi'
        : 'Create account'

  return (
    <div className="home-stage auth-stage">
      <div className="home-atmosphere" aria-hidden>
        <span>גמ׳</span>
      </div>
      <div className="shell home-shell">
      <main className={`home auth-home${isRabbiFlow ? ' auth-home-wide' : ''}`}>
        <button type="button" className="linkish tiny auth-back" onClick={onBack}>
          ← Back
        </button>
        <p className="brand-mark">
          <AppMark size="md" />
        </p>
        <h1>{title}</h1>
        <p className="lede">
          {isRabbiFlow
            ? isApplyOnly
              ? `Signed in as ${signedInAccount?.username || 'you'}. Share a little about how you teach — we review every application before you begin with students.`
              : 'Share a little about how you teach. We review every application before you begin with students.'
            : mode === 'login'
              ? 'Sign in with your username or phone, and your password.'
              : 'Create an account with a username, phone number, and password.'}
        </p>

        <form
          className={`setup auth-setup${isRabbiFlow ? ' auth-setup-rabbi' : ''}`}
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            try {
              let account: Account
              if (mode === 'login') {
                account = await login({
                  username: username.trim() || undefined,
                  phone: phone.trim() || undefined,
                  password,
                })
              } else if (mode === 'apply') {
                account = await applyAsRabbi(answers)
              } else if (mode === 'rabbi') {
                account = await registerRabbi({
                  username,
                  phone,
                  password,
                  answers,
                })
              } else {
                account = await register({ username, phone, password })
              }
              onSignedIn(account)
            } catch (err) {
              setError(
                err instanceof Error ? err.message : 'Something went wrong. Please try again.',
              )
            } finally {
              setBusy(false)
            }
          }}
        >
          {!isApplyOnly && (
            <section className="auth-section">
              {isRabbiFlow && <h2 className="auth-section-title">Your account</h2>}
              <label className="full">
                <span>Username</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required={mode !== 'login'}
                  placeholder={
                    mode === 'login' ? 'Optional if using phone' : 'Choose a username'
                  }
                />
              </label>
              <label className="full">
                <span>Phone</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  required={mode !== 'login'}
                  placeholder={
                    mode === 'login' ? 'Optional if using username' : '+1…'
                  }
                />
              </label>
              <label className="full">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  required
                  minLength={6}
                />
              </label>
            </section>
          )}

          {isRabbiFlow && (
            <section className="auth-section">
              <h2 className="auth-section-title">About your teaching</h2>
              <p className="auth-section-hint">
                A few short answers help us place you with the right students.
              </p>
              <label className="full">
                <span>Name students should use</span>
                <input
                  value={answers.displayName}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      displayName: e.target.value,
                    }))
                  }
                  required
                  placeholder="Rebbi…"
                />
              </label>
              <label className="full">
                <span>Gemara teaching experience</span>
                <textarea
                  value={answers.experience}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      experience: e.target.value,
                    }))
                  }
                  rows={3}
                  required
                  placeholder="Years taught, settings, ages…"
                />
              </label>
              <div className="setup-row auth-row-tight">
                <label>
                  <span>Ages you teach</span>
                  <input
                    value={answers.ages}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, ages: e.target.value }))
                    }
                    required
                    placeholder="e.g. 9–14"
                  />
                </label>
                <label>
                  <span>Availability</span>
                  <input
                    value={answers.availability}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        availability: e.target.value,
                      }))
                    }
                    required
                    placeholder="Evenings, Sundays…"
                  />
                </label>
              </div>
              <label className="full">
                <span>How you like to teach</span>
                <textarea
                  value={answers.approach}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      approach: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Pace, chavrusa style, focus on Rashi…"
                />
              </label>
              <label className="full">
                <span>Why Guide?</span>
                <textarea
                  value={answers.why}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, why: e.target.value }))
                  }
                  rows={3}
                  required
                  placeholder="What draws you to teaching here?"
                />
              </label>
            </section>
          )}

          {error && <p className="bad auth-error">{error}</p>}

          <div className="auth-footer">
            <button type="submit" className="btn-main" disabled={busy}>
              {busy
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Sign in'
                  : isRabbiFlow
                    ? 'Submit application'
                    : 'Create account'}
            </button>
            {!isApplyOnly && (
              <>
                <button
                  type="button"
                  className="linkish tiny tour-link"
                  onClick={() => {
                    setMode((m) => (m === 'login' ? 'register' : 'login'))
                    setError(null)
                  }}
                >
                  {mode === 'login'
                    ? 'Need an account? Register'
                    : 'Already have an account? Sign in'}
                </button>
                {!isRabbiFlow ? (
                  <button
                    type="button"
                    className="linkish tiny tour-link"
                    onClick={() => {
                      setMode('rabbi')
                      setError(null)
                    }}
                  >
                    Become a Rebbi
                  </button>
                ) : (
                  <button
                    type="button"
                    className="linkish tiny tour-link"
                    onClick={() => {
                      setMode('register')
                      setError(null)
                    }}
                  >
                    Register as a student instead
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      </main>
      </div>
    </div>
  )
}
