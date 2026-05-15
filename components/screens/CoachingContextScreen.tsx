'use client'

import { useEffect, useState } from 'react'
import { analyzeCoaching, CoachingContext, ExercisePlan } from '@/lib/coaching'
import { SessionRecord, fetchLastSessionsFromSupabase, fetchWeightOverrides } from '@/lib/supabase.queries'
import { getRoutineAsExercises } from '@/lib/userProgram'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import LoadingScreen from '@/components/LoadingScreen'

interface CoachingContextScreenProps {
  split: string
  programId?: string
  userProgramSplitId?: string
  coachingContext: CoachingContext | null
  plan: ExercisePlan[] | null
  onDataLoaded: (context: CoachingContext, plan: ExercisePlan[], sessions: SessionRecord[]) => void
  onWeightDecision?: (exerciseName: string, accepted: boolean) => void
  onViewPlan: () => void
  onBack: () => void
}

export default function CoachingContextScreen({
  split, programId = 'ppl-default', userProgramSplitId, coachingContext, plan, onDataLoaded, onWeightDecision, onViewPlan, onBack,
}: CoachingContextScreenProps) {
  const [loading, setLoading] = useState(!coachingContext)
  const [error, setError] = useState<string | null>(null)
  const [weightDecisions, setWeightDecisions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (coachingContext) return
    if (!userProgramSplitId) return
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')
        const [sessions, weightOverrides, routine] = await Promise.all([
          fetchLastSessionsFromSupabase(supabase, userProgramSplitId, 5),
          fetchWeightOverrides(supabase, user.id),
          getRoutineAsExercises(supabase, userProgramSplitId),
        ])
        const today = new Date().toISOString().split('T')[0]
        const { context, plan } = analyzeCoaching(programId, split, sessions, today, weightOverrides, routine)
        onDataLoaded(context, plan, sessions)
        setLoading(false)
      } catch (err: any) {
        setError(err.message ?? 'Failed to load')
        setLoading(false)
      }
    })()
  }, [split, programId, userProgramSplitId, coachingContext, onDataLoaded])

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
                    {f.type === 'weight-too-heavy' && f.originalWeight != null && f.suggestedWeight != null && (
                      weightDecisions[f.exercise] != null ? (
                        <p className="font-mono" style={{ fontSize: '0.6rem', color: weightDecisions[f.exercise] ? 'var(--accent)' : 'var(--text-mid)', margin: '6px 0 0 0' }}>
                          {weightDecisions[f.exercise]
                            ? `✓ Dropping to ${f.suggestedWeight} ${f.suggestedWeight === f.originalWeight ? '' : 'lbs'}`
                            : `✓ Keeping ${f.originalWeight} lbs`}
                        </p>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button
                            onClick={() => {
                              setWeightDecisions(prev => ({ ...prev, [f.exercise]: true }))
                              onWeightDecision?.(f.exercise, true)
                            }}
                            className="btn-primary"
                            style={{ flex: 1, fontSize: '0.6rem', padding: '7px 10px', letterSpacing: '0.08em' }}
                          >
                            ACCEPT {f.originalWeight} → {f.suggestedWeight}
                          </button>
                          <button
                            onClick={() => {
                              setWeightDecisions(prev => ({ ...prev, [f.exercise]: false }))
                              onWeightDecision?.(f.exercise, false)
                            }}
                            style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.08em', padding: '7px 10px', cursor: 'pointer' }}
                          >
                            KEEP WEIGHT
                          </button>
                        </div>
                      )
                    )}
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
