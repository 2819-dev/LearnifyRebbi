import { AppMark } from './AppMark'
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
    <div className="home-stage auth-stage">
      <div className="home-atmosphere" aria-hidden>
        <span>גמ׳</span>
      </div>
      <div className="shell home-shell">
        <main className="home auth-home submitted-home">
          <p className="brand-mark">
            <AppMark size="md" />
          </p>
          <p className="status-pill" role="status">
            Under review
          </p>
          <h1>Application received</h1>
          <p className="lede">
            Thanks{name ? `, ${name}` : ''}. We received your application to teach
            as a Rebbi and will be in touch soon.
          </p>

          <div className="submitted-card">
            <h2>What happens next</h2>
            <ol className="submitted-steps">
              <li>We review your teaching background and availability.</li>
              <li>Once welcome to teach, sign in to meet your students.</li>
              <li>Learners can then request to learn with you.</li>
            </ol>
          </div>

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
    </div>
  )
}
