'use client'

import { Split } from '@/lib/routines'
import { PersistedSession } from '@/lib/sessionStorage'

interface ResumePromptScreenProps {
  detectedSession: PersistedSession | null  // full local data
  detectedSplit: Split | null              // DB fallback (split only)
  onResume: () => void
  onFresh: () => void
  onSettings: () => void
  showStartFreshConfirm: boolean
  onConfirmStartFresh: () => void
  onCancelStartFresh: () => void
}

export default function ResumePromptScreen({
  detectedSession, detectedSplit, onResume, onFresh, onSettings,
  showStartFreshConfirm, onConfirmStartFresh, onCancelStartFresh,
}: ResumePromptScreenProps) {
  const split = detectedSession?.split ?? detectedSplit
  const hasFullData = !!detectedSession

  // How far along was the session?
  const completedCount = detectedSession
    ? detectedSession.logs.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed || s.skipped).length, 0)
    : null
  const totalCount = detectedSession
    ? detectedSession.logs.reduce((acc, ex) => acc + ex.sets.length, 0)
    : null
  const exIdx = detectedSession?.exIdx ?? 0
  const currentExName = detectedSession?.logs[exIdx]?.exerciseName ?? null

  const startedAtLabel = detectedSession?.startedAt
    ? (() => {
        const d = new Date(detectedSession.startedAt)
        const now = new Date()
        const diffMs = now.getTime() - d.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        if (diffDays === 0) return 'Started today'
        if (diffDays === 1) return 'Started yesterday'
        return `Started ${diffDays} days ago`
      })()
    : null

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100dvh', background: 'var(--bg)' }}>

      {/* Header */}
      <div
        className="safe-top flex items-center justify-between"
        style={{ padding: '0 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span className="font-display" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
            GYM COACH
          </span>
          <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            v4.0
          </span>
        </div>
        <button
          onClick={onSettings}
          style={{
            background: 'none', border: '1px solid var(--border-2)', borderRadius: '2px',
            padding: '7px 12px', color: 'var(--text-mid)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: 'Bebas Neue, sans-serif', fontSize: '0.95rem', letterSpacing: '0.1em',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          WEIGHTS
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ gap: '0' }}>

        {/* Session label */}
        <p className="section-label" style={{ margin: '0 0 12px 0', textAlign: 'center' }}>
          {hasFullData ? 'UNFINISHED SESSION FOUND' : 'SESSION LOGGED TODAY'}
        </p>

        {/* Split name — big */}
        <h1
          className="font-display"
          style={{
            fontSize: 'clamp(4rem, 18vw, 6rem)',
            color: 'var(--accent)',
            lineHeight: 1,
            letterSpacing: '0.04em',
            margin: '0 0 8px 0',
            textAlign: 'center',
          }}
        >
          {split ?? '—'}
        </h1>
        <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: '0 0 32px 0', letterSpacing: '0.1em' }}>
          DAY
        </p>

        {/* Progress detail — only if we have full local data */}
        {hasFullData && completedCount !== null && totalCount !== null && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '2px', padding: '14px 20px', marginBottom: '32px',
            width: '100%', maxWidth: '280px', textAlign: 'center',
          }}>
            <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: '0 0 6px 0', letterSpacing: '0.08em' }}>
              PROGRESS
            </p>
            <p className="font-display" style={{ fontSize: '2rem', color: 'var(--text-primary)', margin: '0 0 4px 0', letterSpacing: '0.04em' }}>
              {completedCount} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/ {totalCount} sets</span>
            </p>
            {currentExName && (
              <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-mid)', margin: '0 0 2px 0', letterSpacing: '0.06em' }}>
                LEFT OFF AT: {currentExName.toUpperCase()}
              </p>
            )}
            {startedAtLabel && (
              <p className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', margin: 0, letterSpacing: '0.06em' }}>
                {startedAtLabel.toUpperCase()}
              </p>
            )}
          </div>
        )}

        {/* DB-only fallback message */}
        {!hasFullData && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--rust-border)',
            borderRadius: '2px', padding: '12px 16px', marginBottom: '32px',
            width: '100%', maxWidth: '280px',
          }}>
            <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--rust)', margin: 0, lineHeight: 1.6 }}>
              Entries found for today. Start fresh or continue from where you think you left off.
            </p>
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '280px' }}>
          <button className="btn-primary" onClick={onResume}>
            {hasFullData ? 'RESUME SESSION →' : 'CONTINUE TODAY →'}
          </button>
          <button className="btn-secondary" onClick={onFresh}>
            START FRESH
          </button>
        </div>
      </div>

      {/* Footer */}
      <div
        className="safe-bottom flex items-center justify-between px-5"
        style={{ paddingTop: '12px', borderTop: '1px solid var(--border)' }}
      >
        <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>
          TODAY&apos;S SESSION
        </span>
        <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--border-2)', letterSpacing: '0.1em' }}>
          PUSH · PULL · LEGS
        </span>
      </div>

      {showStartFreshConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(12,11,9,0.98)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
          <p className="section-label" style={{ margin: '0 0 10px 0' }}>DISCARD TODAY&apos;S SESSION?</p>
          <h2 className="font-display" style={{ fontSize: '2.5rem', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 8px 0', textAlign: 'center', letterSpacing: '0.04em' }}>
            Start Fresh?
          </h2>
          <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-mid)', margin: '0 0 32px 0', textAlign: 'center', lineHeight: 1.7, maxWidth: '280px' }}>
            This will permanently delete the exercises you&apos;ve already logged today for this split.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '280px' }}>
            <button className="btn-secondary" onClick={onCancelStartFresh}>CANCEL</button>
            <button className="btn-primary" onClick={onConfirmStartFresh}>DISCARD &amp; START FRESH</button>
          </div>
        </div>
      )}
    </div>
  )
}
