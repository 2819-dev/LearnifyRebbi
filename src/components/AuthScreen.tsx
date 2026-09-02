import { useState } from 'react'
import { APP_NAME } from '../lib/brand'
import { login, register, type Account } from '../lib/account'

type Props = {
  onSignedIn: (account: Account) => void
  onBack: () => void
}

export function AuthScreen({ onSignedIn, onBack }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="shell home-shell">
      <main className="home auth-home">
        <button type="button" className="linkish tiny" onClick={onBack}>
          ← Back to {APP_NAME}
        </button>
        <p className="brand">{APP_NAME}</p>
        <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <p className="lede">
          Username, phone number, and password — no email needed.
        </p>

        <form
          className="setup"
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
                  : await register({ username, phone, password })
              onSignedIn(account)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not sign in')
            } finally {
              setBusy(false)
            }
          }}
        >
          <label className="full">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required={mode === 'register'}
              placeholder={mode === 'login' ? 'Optional if using phone' : 'Choose a username'}
            />
          </label>
          <label className="full">
            <span>Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              required={mode === 'register'}
              placeholder={mode === 'login' ? 'Optional if using username' : '+1…'}
            />
          </label>
          <label className="full">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </label>
          {error && <p className="bad">{error}</p>}
          <button type="submit" className="btn-main" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
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
        </form>
      </main>
    </div>
  )
}
