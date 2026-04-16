'use client'

import { useEffect, useState } from 'react'
import { Split } from '@/lib/routines'
import { CoachingContext, ExercisePlan } from '@/lib/coaching'
import { SessionRecord } from '@/lib/notion'
import LoadingScreen from '@/components/LoadingScreen'

interface CoachingContextScreenProps {
  split: Split
  coachingContext: CoachingContext | null
  plan: ExercisePlan[] | null
  onDataLoaded: (context: CoachingContext, plan: ExercisePlan[], sessions: SessionRecord[]) => void
  onViewPlan: () => void
  onBack: () => void
}

export default function CoachingContextScreen({
  split,
  coachingContext,
  plan,
  onDataLoaded,
  onViewPlan,
  onBack,
}: CoachingContextScreenProps) {
  const [loading, setLoading] = useState(!coachingContext)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (coachingContext) return
    setLoading(true)
    fetch(`/api/notion?split=${split}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        onDataLoaded(data.context, data.plan, data.sessions)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [split, coachingContext, onDataLoaded])

  if (loading) return <LoadingScreen message={`Analyzing ${split} history...`} />
  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <p className="font-mono-display text-sm" style={{ color: '#ff6b6b' }}>Error: {error}</p>
      <button onClick={onBack} style={{ color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>
        ← Back
      </button>
    </div>
  )
  if (!coachingContext) return null

  const ctx = coachingContext
  const progressingFlags = ctx.trending
  const watchFlags = ctx.watchFlags.filter(f => f.type !== 'no-history')
  const noHistoryFlags = ctx.watchFlags.filter(f => f.type === 'no-history')

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div
        className="safe-top flex items-center gap-4 px-5"
        style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem' }}
        >
          ←
        </button>
        <div>
          <p className="font-mono-display" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.12em', margin: 0 }}>PRE-SESSION INTEL</p>
          <h1 className="font-mono-display" style={{ fontSize: '1.25rem', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>
            {split} Day
          </h1>
        </div>
        {ctx.deloadRecommended && (
          <span className="tag accent" style={{ marginLeft: 'auto' }}>DELOAD</span>
        )}
      </div>

      {/* Content */}
      <div className="scroll-area flex-1 px-5 py-4" style={{ gap: '12px', display: 'flex', flexDirection: 'column' }}>

        {/* Last session */}
        <div className="card p-4">
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', margin: '0 0 8px 0' }}>
            📅 LAST SESSION
          </p>
          {ctx.lastSessionDate ? (
            <div>
              <p className="font-mono-display" style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                {new Date(ctx.lastSessionDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, fontFamily: 'DM Mono, monospace' }}>
                {ctx.lastSessionSummary}
              </p>
              {ctx.recoveryGap !== null && ctx.recoveryGap < 3 && (
                <p style={{ fontSize: '0.75rem', color: '#ffa500', margin: '6px 0 0 0', fontFamily: 'DM Mono, monospace' }}>
                  ⚠ Only {ctx.recoveryGap}d recovery — holding progression weights
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, fontFamily: 'DM Mono, monospace' }}>
              No previous {split} session found
            </p>
          )}
        </div>

        {/* Trending */}
        {progressingFlags.length > 0 && (
          <div className="card p-4">
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', margin: '0 0 8px 0' }}>
              📈 TRENDING
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {progressingFlags.map((t, i) => (
                <p key={i} style={{ fontSize: '0.8rem', color: 'var(--accent)', margin: 0, fontFamily: 'DM Mono, monospace' }}>
                  ↑ {t}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Watch */}
        {watchFlags.length > 0 && (
          <div className="card p-4">
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', margin: '0 0 8px 0' }}>
              ⚠ WATCH
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {watchFlags.map((f, i) => (
                <div key={i}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', margin: '0 0 2px 0', fontFamily: 'DM Mono, monospace' }}>
                    {f.exercise}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#ffa500', margin: 0, fontFamily: 'DM Mono, monospace' }}>
                    {f.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No history exercises */}
        {noHistoryFlags.length > 0 && (
          <div className="card p-4">
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', margin: '0 0 8px 0' }}>
              🆕 NEW EXERCISES
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {noHistoryFlags.map((f, i) => (
                <p key={i} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, fontFamily: 'DM Mono, monospace' }}>
                  {f.exercise} — set working weight today
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Focus cue */}
        <div className="card p-4" style={{ borderColor: 'rgba(200,241,53,0.2)' }}>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', margin: '0 0 8px 0' }}>
            🎯 FOCUS TODAY
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, fontFamily: 'DM Mono, monospace', lineHeight: 1.5 }}>
            {ctx.focusCue}
          </p>
        </div>

        {/* Pull day cable row variant */}
        {split === 'Pull' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>
              Cable Row today:
            </span>
            <span className="tag accent" style={{ fontSize: '0.7rem' }}>
              {ctx.cableRowVariant.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* CTA */}
      <div
        className="safe-bottom px-5"
        style={{ paddingTop: '16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}
      >
        <button
          onClick={onViewPlan}
          style={{
            width: '100%',
            background: 'var(--accent)',
            color: '#0A0A0A',
            border: 'none',
            borderRadius: '4px',
            padding: '16px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '0.9rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          VIEW SESSION PLAN →
        </button>
      </div>
    </div>
  )
}
