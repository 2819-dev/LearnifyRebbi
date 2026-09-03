import { APP_NAME } from '../lib/brand'
import type { Account } from '../lib/account'

type Props = {
  account: Account
  onSignOut?: () => void
  onContinueLearning?: () => void
}

export function ApplicationSubmitted({
  account,
  onSignOut,
  onContinueLearning,
}: Props) {
  const name = account.rabbiDisplayName || account.username

  return (
    <div className="shell home-shell">
      <div className="home-atmosphere" aria-hidden>
        <span>גמ׳</span>
      </div>
      <main className="home auth-home submitted-home">
        <p className="brand">{APP_NAME}</p>
        <p className="status-pill" role="status">
          Under review
        </p>
        <h1>Application received</h1>
        <p className="lede">
          Thanks{name ? `, ${name}` : ''}. We received your Rebbi application
          and will be in touch when you are approved to teach.
        </p>

        <div className="submitted-card">
          <h2>What happens next</h2>
          <ol className="submitted-steps">
            <li>We read your teaching background and availability.</li>
            <li>When you are approved, sign in to start taking students.</li>
            <li>Students can then request to learn with you.</li>
          </ol>
        </div>

        <div className="submitted-actions">
          {onContinueLearning && (
            <button type="button" className="btn-main" onClick={onContinueLearning}>
              Continue with Guide
            </button>
          )}
          {onSignOut && (
            <button
              type="button"
              className="btn-main btn-secondary"
              onClick={onSignOut}
            >
              Sign out
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
