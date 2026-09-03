import { useState } from 'react'
import { APP_NAME } from '../lib/brand'
import {
  login,
  register,
  registerRabbi,
  type Account,
  type RabbiAnswers,
} from '../lib/account'

type Mode = 'login' | 'register' | 'rabbi'

type Props = {
  onSignedIn: (account: Account) => void
  onBack: () => void
  initialMode?: Mode
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
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [answers, setAnswers] = useState<RabbiAnswers>(EMPTY_ANSWERS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRabbi = mode === 'rabbi'
  const title =
    mode === 'login'
      ? 'Sign in'
      : isRabbi
        ? 'Register as a Rebbi'
        : 'Create account'

  return (
    <div className="shell home-shell">
      <div className="home-atmosphere" aria-hidden>
        <span>גמ׳</span>
      </div>
      <main className={`home auth-home${isRabbi ? ' auth-home-wide' : ''}`}>
        <button type="button" className="linkish tiny auth-back" onClick={onBack}>
          ← Back to {APP_NAME}
        </button>
        <p className="brand">{APP_NAME}</p>
        <h1>{title}</h1>
        <p className="lede">
          {isRabbi
            ? 'Tell us about your teaching. An admin must approve you before the Rebbi panel opens.'
            : 'Username, phone number, and password — no email needed.'}
        </p>

        <form
          className={`setup auth-setup${isRabbi ? ' auth-setup-rabbi' : ''}`}
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            try {
              const account =
                mode === 'login'
                  ? await login({
                      username: username.trim() || undefined,
                      phone: phone.trim() || undefined,
                      password,
                    })
                  : isRabbi
                    ? await registerRabbi({
                        username,
                        phone,
                        password,
                        answers,
                      })
                    : await register({ username, phone, password })
              onSignedIn(account)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not sign in')
            } finally {
              setBusy(false)
            }
          }}
        >
          <section className="auth-section">
            {isRabbi && <h2 className="auth-section-title">Your account</h2>}
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

          {isRabbi && (
            <section className="auth-section">
              <h2 className="auth-section-title">Teaching questionnaire</h2>
              <p className="auth-section-hint">
                Short answers help admins match you with the right students.
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
                  : isRabbi
                    ? 'Submit for approval'
                    : 'Create account'}
            </button>
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
            {!isRabbi ? (
              <button
                type="button"
                className="linkish tiny tour-link"
                onClick={() => {
                  setMode('rabbi')
                  setError(null)
                }}
              >
                Register as a Rebbi
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
          </div>
        </form>
      </main>
    </div>
  )
}
