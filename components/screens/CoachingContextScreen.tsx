'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
// See app/page.tsx's note — the old lib/coaching.ts that used to shadow
// this directory on a bare import was deleted in GYM-97 fix #9.
import { CoachingContext, CoachingFlag } from '@/lib/coaching/index'
import { loadCoachingPlan, SessionExercisePlan } from '@/lib/sessionPlan'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { useCoachingFlagText } from '@/lib/i18n/coachingMessages'
import LoadingScreen from '@/components/LoadingScreen'

interface CoachingContextScreenProps {
  split: string
  userProgramSplitId?: string
  coachingContext: CoachingContext | null
  plan: SessionExercisePlan[] | null
  onDataLoaded: (context: CoachingContext, plan: SessionExercisePlan[]) => void
  /** GYM-97 fix #2: lifted to appState by the caller (app/page.tsx) so a
   *  decision survives this screen remounting (navigate away and back). */
  weightDecisions: Record<string, boolean>
  onWeightDecision?: (exerciseId: string, accepted: boolean) => void
  onViewPlan: () => void
  onBack: () => void
}

/** Renders one CoachingFlag as plain-language (primary) + technical (small
 *  aside) — the Phase 3 requirement: "one data-contract change (two message
 *  renderings per kind) closes both the i18n gap and the literacy gap
 *  together." */
function FlagLine({ flag, accent }: { flag: CoachingFlag; accent?: boolean }) {
  const t = useTranslations('screens.coachingContext')
  const coachingT = useTranslations('coaching')
  const { technical, plain } = useCoachingFlagText(flag)
  const provenanceNote = flag.origin === 'inferred-rep-range' ? ` (${coachingT('provenanceInferred')})` : ''
  return (
    <div>
      <p className="font-sans" style={{ fontSize: '0.85rem', fontWeight: 500, color: accent ? 'var(--accent)' : 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
        {plain}
      </p>
      <p className="font-mono" style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', margin: '3px 0 0 0', letterSpacing: '0.03em' }}>
        {t('technicalLabel')}: {technical}{provenanceNote}
      </p>
    </div>
  )
}

export default function CoachingContextScreen({
  split, userProgramSplitId, coachingContext, plan, onDataLoaded, weightDecisions, onWeightDecision, onViewPlan, onBack,
}: CoachingContextScreenProps) {
  const t = useTranslations('screens.coachingContext')
  const common = useTranslations('common')
  const locale = useLocale()
  const [loading, setLoading] = useState(!coachingContext)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (coachingContext) return
    if (!userProgramSplitId) return
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error(common('notAuthenticated'))
        const { context, plan: loadedPlan } = await loadCoachingPlan(supabase, user.id, userProgramSplitId)
        onDataLoaded(context, loadedPlan)
        setLoading(false)
      } catch (err: any) {
        setError(err.message ?? common('failedToLoad'))
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [split, userProgramSplitId, coachingContext, onDataLoaded])

  if (loading) return <LoadingScreen message={`${t('preSessionIntel')}...`} />
  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <p className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--rust)' }}>{error}</p>
      <button onClick={onBack} style={{ color: 'var(--text-mid)', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}>
        ← {common('back')}
      </button>
    </div>
  )
  if (!coachingContext || !plan) return null

  const ctx = coachingContext

  const progressingItems = plan.filter(p => p.flags.some(f => f.kind === 'progress-ready'))
  const watchItems = plan.filter(p => p.flags.some(f => ['weight-too-heavy', 'fatigue', 'stall', 'recovery-hold'].includes(f.kind)))
  const noHistoryItems = plan.filter(p => p.flags.some(f => f.kind === 'no-history'))
  // Session/muscle-group-scope signals (deload, volume landmarks) live on
  // ctx.flags, not per-exercise — see lib/coaching/types.ts's CoachingContext.
  const signalFlags = ctx.flags

  const dateFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' })

  // Focus cue — composed here (UI layer) from the engine's structured
  // signals, priority: deload > stall > fatigue > progress > default. The
  // engine itself never emits a pre-formatted "focus" string (per its
  // no-string-concatenation contract) — this priority order is a Tier 2 UX
  // choice, not spelled out in the plan.
  const deloadFlag = signalFlags.find(f => f.kind === 'deload-recommended')
  const stallItem = plan.find(p => p.flags.some(f => f.kind === 'stall'))
  const stallFlag = stallItem?.flags.find(f => f.kind === 'stall')
  const fatigueItem = plan.find(p => p.flags.some(f => f.kind === 'fatigue'))
  const fatigueFlag = fatigueItem?.flags.find(f => f.kind === 'fatigue')
  const progressFlag = progressingItems[0]?.flags.find(f => f.kind === 'progress-ready')
  const focusFlag = deloadFlag ?? stallFlag ?? fatigueFlag ?? progressFlag ?? null

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
          <p className="section-label" style={{ margin: '0 0 2px 0' }}>{t('preSessionIntel')}</p>
          <h1 className="font-display" style={{ fontSize: '1.7rem', margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1 }}>
            {common('splitDay', { split })}
          </h1>
        </div>
        {ctx.deloadRecommended && (
          <span className="tag rust">{t('deload')}</span>
        )}
      </div>

      {/* Content */}
      <div className="scroll-area flex-1 px-5 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Data maturity notice — Phase 2's dataMaturity signal */}
          {ctx.dataMaturity !== 'established' && (
            <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px dashed var(--border-2)', borderRadius: '2px' }}>
              <p className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', margin: 0, letterSpacing: '0.02em', lineHeight: 1.5 }}>
                {ctx.dataMaturity === 'limited-history' ? t('dataMaturityLimited') : t('dataMaturityDeveloping')}
              </p>
            </div>
          )}

          {/* Last session */}
          <div className="card p-4">
            <p className="section-label" style={{ margin: '0 0 10px 0' }}>{t('lastSession')}</p>
            {ctx.lastSessionDate ? (
              <div>
                <p className="font-display" style={{ fontSize: '1.3rem', color: 'var(--text-primary)', margin: '0 0 3px 0', letterSpacing: '0.04em' }}>
                  {dateFormatter.format(new Date(ctx.lastSessionDate + 'T12:00:00'))}
                </p>
                {/* GYM-97 fix #10: brief recap restored after Phase 3 dropped
                   the old engine's lastSessionSummary string. */}
                {ctx.lastSessionExerciseCount !== null && (
                  <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-mid)', margin: '2px 0 0 0' }}>
                    {t('lastSessionExerciseCount', { count: ctx.lastSessionExerciseCount })}
                  </p>
                )}
                {ctx.recoveryGapDays !== null && ctx.recoveryGapDays < 3 && (
                  <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--rust)', margin: '6px 0 0 0' }}>
                    ⚠ {t('recoveryWarning', { days: ctx.recoveryGapDays })}
                  </p>
                )}
              </div>
            ) : (
              <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>
                {t('noPreviousSession', { split })}
              </p>
            )}
          </div>

          {/* Trending */}
          {progressingItems.length > 0 && (
            <div className="card-accent p-4">
              <p className="section-label" style={{ margin: '0 0 8px 0', color: 'var(--accent)' }}>{t('trendingUp')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {progressingItems.map(item => {
                  const flag = item.flags.find(f => f.kind === 'progress-ready')!
                  return (
                    <div key={item.exerciseId}>
                      <p className="font-sans" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>
                        {item.exercise.name}
                      </p>
                      <FlagLine flag={flag} accent />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Session/muscle-group signals — deload, volume landmarks. Own
              label (not the shared "watch") since this is program-level
              (is this session's training balanced?), distinct from the
              per-exercise watch items below. */}
          {signalFlags.length > 0 && (
            <div className="card-rust p-4">
              <p className="section-label" style={{ margin: '0 0 8px 0', color: 'var(--rust)' }}>{t('programBalance')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {signalFlags.map(flag => (
                  <FlagLine key={flag.id} flag={flag} />
                ))}
              </div>
            </div>
          )}

          {/* Watch — per-exercise flags */}
          {watchItems.length > 0 && (
            <div className="card-rust p-4">
              <p className="section-label" style={{ margin: '0 0 8px 0', color: 'var(--rust)' }}>{t('watch')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {watchItems.map(item => {
                  const weightFlag = item.flags.find(f => f.kind === 'weight-too-heavy')
                  const otherFlags = item.flags.filter(f => ['fatigue', 'stall', 'recovery-hold'].includes(f.kind))
                  return (
                    <div key={item.exerciseId}>
                      <p className="font-sans" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                        {item.exercise.name}
                      </p>
                      {otherFlags.map(f => <FlagLine key={f.id} flag={f} />)}
                      {weightFlag && (
                        <>
                          <FlagLine flag={weightFlag} />
                          {weightDecisions[item.exerciseId] != null ? (
                            <p className="font-mono" style={{ fontSize: '0.6rem', color: weightDecisions[item.exerciseId] ? 'var(--accent)' : 'var(--text-mid)', margin: '6px 0 0 0' }}>
                              {weightDecisions[item.exerciseId]
                                ? t('droppingTo', { weight: `${item.targetWeight} ${item.exercise.weightUnit === 'pins' ? common('pins') : common('lbs')}` })
                                : t('keepWeightValue', { weight: `${weightFlag.params.weight} ${item.exercise.weightUnit === 'pins' ? common('pins') : common('lbs')}` })}
                            </p>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <button
                                onClick={() => onWeightDecision?.(item.exerciseId, true)}
                                className="btn-primary"
                                style={{ flex: 1, fontSize: '0.6rem', padding: '7px 10px', letterSpacing: '0.08em' }}
                              >
                                {t('acceptWeight', { from: Number(weightFlag.params.weight), to: item.targetWeight ?? 0 })}
                              </button>
                              <button
                                onClick={() => onWeightDecision?.(item.exerciseId, false)}
                                style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.08em', padding: '7px 10px', cursor: 'pointer' }}
                              >
                                {t('keepWeight')}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* No history */}
          {noHistoryItems.length > 0 && (
            <div className="card p-4">
              <p className="section-label" style={{ margin: '0 0 8px 0' }}>{t('newExercises')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {noHistoryItems.map(item => (
                  <p key={item.exerciseId} className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-mid)', margin: 0 }}>
                    {item.exercise.name}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Focus cue */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '3px solid var(--accent)', borderRadius: '0 0 2px 2px', padding: '14px 14px 14px' }}>
            <p className="section-label" style={{ margin: '0 0 8px 0', color: 'var(--accent)' }}>{t('focusToday')}</p>
            {focusFlag ? (
              <p className="font-sans" style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                <FocusText flag={focusFlag} />
              </p>
            ) : (
              <p className="font-sans" style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                {t('focusDefault')}
              </p>
            )}
          </div>

        </div>
      </div>

      {/* CTA */}
      <div
        className="safe-bottom px-5"
        style={{ paddingTop: '14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}
      >
        <button className="btn-primary" onClick={onViewPlan}>
          {t('viewPlan')}
        </button>
      </div>
    </div>
  )
}

function FocusText({ flag }: { flag: CoachingFlag }) {
  const { plain } = useCoachingFlagText(flag)
  return <>{plain}</>
}
