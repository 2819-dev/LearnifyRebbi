import { useEffect, useMemo, useState } from 'react'
import curriculum from '../data/hashavas-aveidah.json'
import {
  APP_NAME,
  REBBE_VOICES,
  loadLearningPrefs,
  loadLearningProgress,
  saveLearningPrefs,
  type LearningProgress,
  type TalkMode,
} from '../lib/brand'
import { TRACTATES } from '../lib/curriculum'
import {
  fetchMyLearningRequests,
  isApprovedRabbi,
  learningRequestStatusLabel,
  type Account,
  type LearningRequest,
} from '../lib/account'
import { unlockAudio } from '../lib/rebbe'
import { normalizeDaf } from '../lib/sefaria'
import { TalkModePicker } from './TalkModePicker'
import { LearnPathPicker, type LearnPath } from './LearnPathPicker'
import { AccountMenu, type AccountMenuItem } from './AccountMenu'

type Props = {
  onStart: (opts: {
    daf: string
    voiceId: string
    tractateId: string
    talkMode: TalkMode
    lineIndex?: number
  }) => void
  onLearnWithRebbi: () => void
  onShowTour?: () => void
  account?: Account | null
  onSignIn?: () => void
  onRegisterRabbi?: () => void
  onOpenPendingApplication?: () => void
  onSignOut?: () => void
  onOpenAdmin?: () => void
  onOpenTesting?: () => void
  onOpenRabbiPanel?: () => void
  onOpenSupport?: () => void
}

function initPrefs() {
  const prefs = loadLearningPrefs()
  const progress = loadLearningProgress()
  const talkMode = prefs.talkMode || progress?.talkMode || 'voice'
  const voiceId =
    prefs.voiceId ||
    progress?.voiceId ||
    REBBE_VOICES[0].id
  const tractateId =
    prefs.tractateId ||
    progress?.tractateId ||
    TRACTATES[0].id
  const daf =
    prefs.daf ||
    progress?.daf ||
    curriculum.defaultDaf
  return { talkMode, voiceId, tractateId, daf, progress }
}

export function Home({
  onStart,
  onLearnWithRebbi,
  onShowTour,
  account,
  onSignIn,
  onRegisterRabbi,
  onOpenPendingApplication,
  onSignOut,
  onOpenAdmin,
  onOpenTesting,
  onOpenRabbiPanel,
  onOpenSupport,
}: Props) {
  const initial = useMemo(() => initPrefs(), [])
  const [tractateId, setTractateId] = useState(initial.tractateId)
  const [daf, setDaf] = useState(initial.daf)
  const [voiceId, setVoiceId] = useState<string>(initial.voiceId)
  const [talkMode, setTalkMode] = useState<TalkMode>(initial.talkMode)
  const [learnPath, setLearnPath] = useState<LearnPath>('guide')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress] = useState<LearningProgress | null>(initial.progress)
  const [matchRequest, setMatchRequest] = useState<LearningRequest | null>(null)

  const tractate = useMemo(
    () => TRACTATES.find((t) => t.id === tractateId) || TRACTATES[0],
    [tractateId],
  )
  const preview = useMemo(() => normalizeDaf(daf), [daf])
  const pendingRabbi = account?.rabbiStatus === 'pending'
  const rejectedRabbi = account?.rabbiStatus === 'rejected'
  const canBecomeRabbi =
    !account ||
    (!isApprovedRabbi(account) &&
      account.rabbiStatus !== 'pending')

  useEffect(() => {
    if (!account || isApprovedRabbi(account)) {
      setMatchRequest(null)
      return
    }
    let cancelled = false
    fetchMyLearningRequests()
      .then((reqs) => {
        if (cancelled) return
        const active =
          reqs.find((r) => r.status === 'claimed') ||
          reqs.find((r) => r.status === 'open') ||
          null
        setMatchRequest(active)
      })
      .catch(() => {
        if (!cancelled) setMatchRequest(null)
      })
    return () => {
      cancelled = true
    }
  }, [account])

  async function beginLearning(opts?: {
    daf?: string
    lineIndex?: number
    tractateId?: string
    voiceId?: string
    talkMode?: TalkMode
  }) {
    const nextTalk = opts?.talkMode || talkMode
    const nextVoice = opts?.voiceId || voiceId
    const nextTractate = opts?.tractateId || tractate.id
    const nextDaf = normalizeDaf(opts?.daf || preview)
    const topic = TRACTATES.find((t) => t.id === nextTractate) || tractate
    if (!topic.enabled) {
      setError('That sugya is coming soon. Choose an available topic.')
      return
    }
    setError(null)
    setStarting(true)
    try {
      await unlockAudio()
      saveLearningPrefs({
        tractateId: nextTractate,
        daf: nextDaf,
        voiceId: nextVoice,
        talkMode: nextTalk,
      })
      onStart({
        daf: nextDaf,
        voiceId: nextVoice,
        tractateId: nextTractate,
        talkMode: nextTalk,
        lineIndex: opts?.lineIndex,
      })
    } catch {
      setStarting(false)
      setError('Something went wrong. Please try again.')
    }
  }

  const menuItems = useMemo(() => {
    const items: AccountMenuItem[] = []
    if (account) {
      if (account.role === 'admin' && onOpenAdmin) {
        items.push({ id: 'admin', label: 'Owner tools', onClick: onOpenAdmin })
      }
      if (isApprovedRabbi(account) && onOpenRabbiPanel) {
        items.push({
          id: 'desk',
          label: 'Teaching desk',
          onClick: onOpenRabbiPanel,
        })
      }
      if (
        (account.role === 'admin' || account.role === 'tester') &&
        onOpenTesting
      ) {
        items.push({ id: 'coach', label: 'Coaching', onClick: onOpenTesting })
      }
      if (canBecomeRabbi && onRegisterRabbi) {
        items.push({
          id: 'become',
          label: rejectedRabbi ? 'Rebbi application' : 'Become a Rebbi',
          onClick: onRegisterRabbi,
        })
      }
      if (onSignOut) {
        items.push({
          id: 'out',
          label: 'Sign out',
          onClick: onSignOut,
          tone: 'quiet',
        })
      }
    } else {
      if (onSignIn) {
        items.push({ id: 'in', label: 'Sign in', onClick: onSignIn })
      }
      if (onRegisterRabbi) {
        items.push({
          id: 'become',
          label: 'Become a Rebbi',
          onClick: onRegisterRabbi,
        })
      }
    }
    if (onOpenSupport) {
      items.push({ id: 'support', label: 'Support', onClick: onOpenSupport })
    }
    if (onShowTour) {
      items.push({
        id: 'tour',
        label: 'How Guide works',
        onClick: onShowTour,
        tone: 'quiet',
      })
    }
    return items
  }, [
    account,
    canBecomeRabbi,
    rejectedRabbi,
    onOpenAdmin,
    onOpenRabbiPanel,
    onOpenTesting,
    onRegisterRabbi,
    onSignOut,
    onSignIn,
    onOpenSupport,
    onShowTour,
  ])

  return (
    <div className="home-stage">
      <div className="home-bleed" aria-hidden>
        <img className="home-amud" src="/amud-hero.svg" alt="" />
        <div className="home-bleed-veil" />
      </div>

      <div className="shell home-shell">
        <main className="home">
          <AccountMenu
            greeting={account ? `Hi, ${account.username}` : null}
            items={menuItems}
          />

          <header className="home-hero">
            <p className="brand">{APP_NAME}</p>
            <p className="lede">A Rebbi beside the page.</p>
          </header>

          {pendingRabbi && (
            <div className="pending-banner">
              <p className="soft path-note">
                Your Rebbi application is under review.
              </p>
              {onOpenPendingApplication && (
                <button
                  type="button"
                  className="linkish tiny"
                  onClick={onOpenPendingApplication}
                >
                  View application status
                </button>
              )}
            </div>
          )}

          {rejectedRabbi && (
            <div className="pending-banner">
              <p className="soft path-note">
                Your Rebbi application was not approved.
              </p>
              {onOpenPendingApplication && (
                <button
                  type="button"
                  className="linkish tiny"
                  onClick={onOpenPendingApplication}
                >
                  See options
                </button>
              )}
            </div>
          )}

          {matchRequest && (
            <div className="pending-banner match-banner">
              <p className="soft path-note">
                {matchRequest.status === 'claimed'
                  ? `Matched with ${
                      matchRequest.rabbiDisplayName ||
                      matchRequest.rabbiUsername ||
                      'a Rebbi'
                    }.`
                  : 'Your Rebbi request is waiting.'}{' '}
                {learningRequestStatusLabel(matchRequest.status)}
              </p>
              <button
                type="button"
                className="linkish tiny"
                onClick={onLearnWithRebbi}
              >
                View match
              </button>
            </div>
          )}

          {progress && learnPath === 'guide' && (
            <div className="continue-banner">
              <div>
                <p className="continue-label">Continue where you left off</p>
                <p className="soft path-note">
                  Bava Metzia {progress.daf}
                  {progress.lineIndex > 0
                    ? ` · line ${progress.lineIndex + 1}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                className="btn-main"
                disabled={starting}
                onClick={() =>
                  void beginLearning({
                    daf: progress.daf,
                    lineIndex: progress.lineIndex,
                    tractateId: progress.tractateId,
                    voiceId: progress.voiceId,
                    talkMode: progress.talkMode,
                  })
                }
              >
                Resume
              </button>
            </div>
          )}

          <form
            className="setup"
            onSubmit={(e) => {
              e.preventDefault()
              if (learnPath === 'rebbe') {
                onLearnWithRebbi()
                return
              }
              void beginLearning()
            }}
          >
            <LearnPathPicker value={learnPath} onChange={setLearnPath} />

            {learnPath === 'guide' && (
              <>
                <label className="full">
                  <span>What you are learning</span>
                  <select
                    value={tractateId}
                    onChange={(e) => {
                      const next = TRACTATES.find((t) => t.id === e.target.value)
                      setTractateId(e.target.value)
                      if (next) setDaf(next.defaultDaf)
                    }}
                    aria-label="What you are learning"
                  >
                    {TRACTATES.map((t) => (
                      <option key={t.id} value={t.id} disabled={!t.enabled}>
                        {t.label}
                        {!t.enabled ? ' (soon)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="setup-row">
                  <label>
                    <span>Masechta</span>
                    <strong>{tractate.masechta}</strong>
                  </label>
                  <label>
                    <span>Start from daf</span>
                    <input
                      value={daf}
                      onChange={(e) => setDaf(e.target.value)}
                      placeholder="21a"
                      inputMode="text"
                      autoComplete="off"
                      aria-label="Start from daf"
                    />
                  </label>
                </div>

                <TalkModePicker value={talkMode} onChange={setTalkMode} />

                {talkMode === 'voice' && (
                  <label className="full">
                    <span>Voice</span>
                    <select
                      value={voiceId}
                      onChange={(e) => setVoiceId(e.target.value)}
                      aria-label="Rebbi voice"
                    >
                      {REBBE_VOICES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}

            {learnPath === 'rebbe' && (
              <p className="soft path-note">
                Request an available Rebbi, or leave a message if none are free.
              </p>
            )}

            {error && <p className="bad auth-error">{error}</p>}

            <button type="submit" className="btn-main" disabled={starting}>
              {starting
                ? 'Opening…'
                : learnPath === 'rebbe'
                  ? 'Continue'
                  : 'Begin'}
            </button>

            {onShowTour && (
              <button
                type="button"
                className="linkish tiny tour-link"
                onClick={onShowTour}
              >
                How Guide works
              </button>
            )}
          </form>
        </main>
      </div>
    </div>
  )
}
