'use client'

import { useEffect, useState } from 'react'
import { CoachingContext, ExercisePlan } from '@/lib/coaching'
import { SessionRecord } from '@/lib/notion'
import LoadingScreen from '@/components/LoadingScreen'

interface CoachingContextScreenProps {
  split: string
  programId?: string
  userProgramSplitId?: string
  coachingContext: CoachingContext | null
  plan: ExercisePlan[] | null
  unavailableExercises: string[]
  onDataLoaded: (context: CoachingContext, plan: ExercisePlan[], sessions: SessionRecord[]) => void
  onViewPlan: () => void
  onBack: () => void
}

export default function CoachingContextScreen({
  split, programId = 'ppl-default', userProgramSplitId, coachingContext, plan, unavailableExercises, onDataLoaded, onViewPlan, onBack,
}: CoachingContextScreenProps) {
  const [loading, setLoading] = useState(!coachingContext)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (coachingContext) return
    setLoading(true)
    const unavailableParam = unavailableExercises.length > 0
      ? `&unavailable=${encodeURIComponent(unavailableExercises.join(','))}`
      : ''
    const params = new URLSearchParams({ split, programId })
    if (userProgramSplitId) params.set('userProgramSplitId', userProgramSplitId)
    if (unavailableExercises.length > 0) params.set('unavailable', unavailableExercises.join(','))
    fetch(`/api/notion?${params}`)
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
  }, [split, programId, userProgramSplitId, coachingContext, unavailableExercises, onDataLoaded])

  if (loading) return <LoadingScreen message={`Analyzing ${split} history...`} />
  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <p className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--rust)' }}>Error: {error}</p>
      <button onClick={onBack} style={{ color: 'var(--text-mid)', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}>
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
        style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', padding: '4px', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem' }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <p className="section-label" style={{ margin: '0 0 2px 0' }}>PRE-SESSION INTEL</p>
          <h1 className="font-display" style={{ fontSize: '1.7rem', margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1 }}>
            {split} Day
          </h1>
        </div>
        {ctx.deloadRecommended && (
          <span className="tag rust">DELOAD</span>
        )}
      </div>

      {/* Content */}
      <div className="scroll-area flex-1 px-5 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Last session */}
          <div className="card p-4">
            <p className="section-label" style={{ margin: '0 0 10px 0' }}>LAST SESSION</p>
            {ctx.lastSessionDate ? (
              <div>
                <p className="font-display" style={{ fontSize: '1.3rem', color: 'var(--text-primary)', margin: '0 0 3px 0', letterSpacing: '0.04em' }}>
                  {new Date(ctx.lastSessionDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-mid)', margin: 0, lineHeight: 1.6 }}>
                  {ctx.lastSessionSummary}
                </p>
                {ctx.recoveryGap !== null && ctx.recoveryGap < 3 && (
                  <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--rust)', margin: '6px 0 0 0' }}>
                    ⚠ Only {ctx.recoveryGap}d recovery — holding progression
                  </p>
                )}
              </div>
            ) : (
              <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>
                No previous {split} session found
              </p>
            )}
          </div>

          {/* Trending */}
          {progressingFlags.length > 0 && (
            <div className="card-accent p-4">
              <p className="section-label" style={{ margin: '0 0 8px 0', color: 'var(--accent)' }}>TRENDING UP</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {progressingFlags.map((t, i) => (
                  <p key={i} className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--accent)', margin: 0 }}>
                    ↑ {t}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Watch */}
          {watchFlags.length > 0 && (
            <div className="card-rust p-4">
              <p className="section-label" style={{ margin: '0 0 8px 0', color: 'var(--rust)' }}>WATCH</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {watchFlags.map((f, i) => (
                  <div key={i}>
                    <p className="font-sans" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>
                      {f.exercise}
                    </p>
                    <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--rust)', margin: 0 }}>
                      {f.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No history */}
          {noHistoryFlags.length > 0 && (
            <div className="card p-4">
              <p className="section-label" style={{ margin: '0 0 8px 0' }}>NEW EXERCISES</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {noHistoryFlags.map((f, i) => (
                  <p key={i} className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-mid)', margin: 0 }}>
                    {f.exercise} — {f.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Focus cue */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '3px solid var(--accent)', borderRadius: '0 0 2px 2px', padding: '14px 14px 14px' }}>
            <p className="section-label" style={{ margin: '0 0 8px 0', color: 'var(--accent)' }}>FOCUS TODAY</p>
            <p className="font-sans" style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
              {ctx.focusCue}
            </p>
          </div>

        </div>
      </div>

      {/* CTA */}
      <div
        className="safe-bottom px-5"
        style={{ paddingTop: '14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}
      >
        <button className="btn-primary" onClick={onViewPlan}>
          VIEW SESSION PLAN →
        </button>
      </div>
    </div>
  )
}
