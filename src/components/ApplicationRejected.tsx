import { AppMark } from './AppMark'
import type { Account } from '../lib/account'

type Props = {
  account: Account
  onContinueLearning?: () => void
  onReapply?: () => void
  onSignOut?: () => void
}

export function ApplicationRejected({
  account,
  onContinueLearning,
  onReapply,
  onSignOut,
}: Props) {
  const name = account.rabbiDisplayName || account.username

  return (
    <div className="home-stage auth-stage">
      <div className="home-atmosphere" aria-hidden>
        <span>גמ׳</span>
      </div>
      <div className="shell home-shell">
        <main className="home auth-home submitted-home">
          <p className="brand-mark">
            <AppMark size="md" />
          </p>
          <p className="status-pill status-pill-muted" role="status">
            Not approved
          </p>
          <h1>Application update</h1>
          <p className="lede">
            Thanks{name ? `, ${name}` : ''}. We are not opening a teaching desk
            for this application right now. You can keep learning with Guide, or
            submit a new application later.
          </p>

          <div className="submitted-actions">
            {onContinueLearning && (
              <button
                type="button"
                className="btn-main"
                onClick={onContinueLearning}
              >
                Continue with Guide
              </button>
            )}
            {onReapply && (
              <button
                type="button"
                className="btn-main btn-secondary"
                onClick={onReapply}
              >
                Apply again
              </button>
            )}
            {onSignOut && (
              <button
                type="button"
                className="linkish tiny tour-link"
                onClick={onSignOut}
              >
                Sign out
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
