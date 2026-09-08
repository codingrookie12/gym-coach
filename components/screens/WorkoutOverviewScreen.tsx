'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CARDIO_RECOMMENDATION } from '@/lib/routines'
import { SessionExercisePlan } from '@/lib/sessionPlan'
import { useCoachingFlagText } from '@/lib/i18n/coachingMessages'
import AddExerciseSheet from '@/components/AddExerciseSheet'
import RemoveExerciseSheet from '@/components/RemoveExerciseSheet'
import ExerciseDetailSheet from '@/components/ExerciseDetailSheet'
import ExerciseProgressionStrip from '@/components/ExerciseProgressionStrip'
import { ExerciseDefinition, findExerciseByName, getAlternatives, getUniqueEquipment } from '@/lib/exerciseLibrary'
import type { ExerciseProgressionStrip as ProgressionData } from '@/lib/supabase.queries'
import { pickPriorityFlag } from '@/lib/coaching/index'

interface WorkoutOverviewScreenProps {
  split: string
  plan: SessionExercisePlan[]
  hasResumable?: boolean
  onBegin: () => void
  onResume?: () => void
  onBack: () => void
  onAddExercise?: (name: string, matched: ExerciseDefinition | null, prefillWeight: number | null, prefillReps: number | null) => void
  onRemoveFromSessionOnly?: (entry: SessionExercisePlan, index: number) => void
  onRemoveFromRoutine?: (entry: SessionExercisePlan, index: number) => void
  onSessionSwap?: (oldName: string, newName: string) => void
}

type PendingSwap = { exIdx: number; oldName: string; newName: string }

function ItemFlags({ item }: { item: SessionExercisePlan }) {
  const t = useTranslations('screens.workoutOverview')
  // The item's highest-signal flag drives the note line — GYM-97 fix #6:
  // now the shared lib/coaching/flagPriority.ts ordering, also used by
  // SessionSummaryScreen, so the two screens never disagree on "the" flag
  // for the same exercise state.
  const flag = pickPriorityFlag(item.flags)
  const rendered = useCoachingFlagText(flag ?? item.flags[0] ?? { kind: 'no-history', params: {} } as any)
  if (!flag) return null
  const accent = flag.kind === 'progress-ready'
  return (
    <div style={{ marginTop: '6px' }}>
      <p className="font-mono" style={{ fontSize: '0.6rem', color: accent ? 'var(--accent)' : 'var(--rust)', margin: 0, opacity: 0.9, lineHeight: 1.4 }}>
        {accent ? '↑' : '⚠'} {rendered.plain}
      </p>
      <p className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
        {t('technicalLabel')}: {rendered.technical}
      </p>
    </div>
  )
}

export default function WorkoutOverviewScreen({ split, plan, hasResumable, onBegin, onResume, onBack, onAddExercise, onRemoveFromSessionOnly, onRemoveFromRoutine, onSessionSwap }: WorkoutOverviewScreenProps) {
  const t = useTranslations('screens.workoutOverview')
  const common = useTranslations('common')
  const [swappedIndex, setSwappedIndex] = useState<number | null>(null)
  const [pendingSwap, setPendingSwap] = useState<PendingSwap | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{ entry: SessionExercisePlan; index: number } | null>(null)
  const [detailExercise, setDetailExercise] = useState<ExerciseDefinition | null>(null)
  const [progression, setProgression] = useState<Record<string, ProgressionData>>({})
  const cardio = CARDIO_RECOMMENDATION[split]
  const canRemove = !!onRemoveFromSessionOnly && !!onRemoveFromRoutine

  useEffect(() => {
    const names = Array.from(new Set(plan.map(p => p.exercise.name).filter(Boolean)))
    if (!names.length) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/history/exercise-strip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names }),
        })
        if (!res.ok) return
        const data = (await res.json()) as Record<string, ProgressionData>
        if (!cancelled) setProgression(data ?? {})
      } catch {
        // enrichment only — silent failure leaves cards unaffected
      }
    })()
    return () => { cancelled = true }
  }, [plan])

  function toggleSwap(i: number) {
    setSwappedIndex(prev => prev === i ? null : i)
    setPendingSwap(null)
  }

  function requestSwap(exIdx: number, oldName: string, newName: string) {
    setPendingSwap({ exIdx, oldName, newName })
  }

  function confirmSwap() {
    if (!pendingSwap) return
    onSessionSwap?.(pendingSwap.oldName, pendingSwap.newName)
    setPendingSwap(null)
    setSwappedIndex(null)
  }

  function getSwapOptions(exercise: SessionExercisePlan['exercise']): string[] {
    const options: string[] = []
    if (exercise.backup) options.push(exercise.backup)
    const def = findExerciseByName(exercise.name)
    if (def) {
      const alts = getAlternatives(def, {
        availableEquipment: getUniqueEquipment(),
        excludeNames: [exercise.name, ...(exercise.backup ? [exercise.backup] : [])],
        limit: 2,
      })
      options.push(...alts.map(a => a.name))
    }
    return options
  }

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
          <p className="section-label" style={{ margin: '0 0 2px 0' }}>{t('sessionPlan')}</p>
          <h1 className="font-display" style={{ fontSize: '1.7rem', margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1 }}>
            {common('splitDay', { split })}
          </h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span className="font-display" style={{ fontSize: '1.8rem', color: 'var(--accent)', lineHeight: 1, letterSpacing: '0.02em' }}>
            {plan.length}
          </span>
          <span className="section-label">{t('exercisesLabel')}</span>
        </div>
      </div>

      {/* Exercise list */}
      <div className="scroll-area flex-1 px-5 py-3" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {plan.map((item, i) => {
            const isSwapped = swappedIndex === i
            const hasFlags = item.flags.length > 0
            return (
              <div
                key={i}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderLeft: hasFlags ? '3px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: hasFlags ? '0 2px 2px 0' : '2px',
                  padding: '12px 14px',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    {/* Exercise name row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--border-2)', letterSpacing: '0.08em', minWidth: '16px' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <button
                        onClick={() => setDetailExercise(findExerciseByName(item.exercise.name) ?? null)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                      >
                        <span className="font-sans" style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '0.02em', textDecoration: 'underline', textDecorationColor: 'var(--border-2)', textUnderlineOffset: '3px' }}>
                          {item.exercise.name}
                        </span>
                      </button>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-mid)' }}>
                        {item.exercise.sets} {common('sets')}
                      </span>
                      <span style={{ color: 'var(--border-2)', fontSize: '0.6rem' }}>·</span>
                      <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-mid)' }}>
                        {item.exercise.repRange[0] === item.exercise.repRange[1]
                          ? `${item.exercise.repRange[0]} ${common('reps')}`
                          : `${item.exercise.repRange[0]}–${item.exercise.repRange[1]} ${common('reps')}`}
                      </span>
                      {item.targetWeight !== null ? (
                        <>
                          <span style={{ color: 'var(--border-2)', fontSize: '0.6rem' }}>·</span>
                          <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>
                            {item.targetWeight} {item.exercise.weightUnit === 'pins' ? common('pins') : common('lbs')}
                          </span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: 'var(--border-2)', fontSize: '0.6rem' }}>·</span>
                          <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            {t('noWeightLogged')}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Progression strip (PR + last 3 + sparkline) */}
                    <ExerciseProgressionStrip data={progression[item.exercise.name]} targetWeight={item.targetWeight} />

                    {/* Coaching flags — plain + technical, Phase 2 contract */}
                    <ItemFlags item={item} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0, marginTop: '2px' }}>
                    <button
                      className="swap-badge"
                      onClick={() => toggleSwap(i)}
                    >
                      {isSwapped ? common('hide') : common('swap')}
                    </button>
                    {canRemove && (
                      <button
                        onClick={() => setRemoveTarget({ entry: item, index: i })}
                        aria-label={`Remove ${item.exercise.name}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          display: 'flex',
                          alignItems: 'center',
                          lineHeight: 1,
                          transition: 'color 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--rust)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Swap options */}
                {isSwapped && (() => {
                  const options = getSwapOptions(item.exercise)

                  // Confirmation step
                  if (pendingSwap?.exIdx === i) return (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                      <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-mid)', marginBottom: '10px', lineHeight: 1.5 }}>
                        {t('swapForToday', { oldName: pendingSwap.oldName, newName: pendingSwap.newName })}
                        <br />
                        <span style={{ color: 'var(--text-secondary)' }}>{t('swapNote')}</span>
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-primary" onClick={confirmSwap} style={{ flex: 1, fontSize: '0.7rem', padding: '8px' }}>
                          {t('confirmSwap')}
                        </button>
                        <button onClick={() => setPendingSwap(null)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.08em', padding: '8px 14px', cursor: 'pointer' }}>
                          {t('cancelSwap')}
                        </button>
                      </div>
                    </div>
                  )

                  if (!options.length) return (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                      <span className="section-label" style={{ color: 'var(--text-secondary)' }}>{t('noAlternativesFound')}</span>
                    </div>
                  )
                  return (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className="section-label" style={{ marginBottom: '2px' }}>{t('swapForTodayButton')}</span>
                      {options.map(altName => (
                        <div
                          key={altName}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}
                        >
                          <button
                            onClick={() => setDetailExercise(findExerciseByName(altName) ?? null)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flex: 1 }}
                          >
                            <span className="font-sans" style={{ fontSize: '0.85rem', color: 'var(--text-mid)', fontWeight: 400, textDecoration: 'underline', textDecorationColor: 'var(--border-2)', textUnderlineOffset: '3px' }}>
                              {altName}
                            </span>
                          </button>
                          <button
                            className="swap-badge"
                            onClick={() => requestSwap(i, item.exercise.name, altName)}
                            style={{ fontSize: '0.55rem', letterSpacing: '0.06em' }}
                          >
                            {t('useToday')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>

        {/* Cardio recommendation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: '2px', marginTop: '4px' }}>
          <span className="section-label" style={{ color: 'var(--accent)', flexShrink: 0 }}>{t('cardio')}</span>
          <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-mid)' }}>{cardio}</span>
        </div>

        {/* Add exercise */}
        {onAddExercise && (
          <button
            onClick={() => setShowAddSheet(true)}
            style={{
              marginTop: '4px',
              width: '100%',
              background: 'transparent',
              border: '1px dashed var(--border-2)',
              borderRadius: '2px',
              padding: '12px',
              color: 'var(--text-secondary)',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-border)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-2)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
            }}
          >
            {t('addExercise')}
          </button>
        )}
      </div>

      {/* CTA */}
      <div
        className="safe-bottom px-5"
        style={{ paddingTop: '14px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        {hasResumable && onResume && (
          <button className="btn-primary" onClick={onResume}>
            {t('resumeSessionButton')}
          </button>
        )}
        <button
          onClick={onBegin}
          className={hasResumable ? 'btn-secondary' : 'btn-primary'}
        >
          {hasResumable ? t('startFreshButton') : t('beginWorkout')}
        </button>
      </div>

      {showAddSheet && onAddExercise && (
        <AddExerciseSheet
          onAdd={(name, matched, prefillWeight, prefillReps) => {
            onAddExercise(name, matched, prefillWeight, prefillReps)
            setShowAddSheet(false)
          }}
          onClose={() => setShowAddSheet(false)}
        />
      )}

      {removeTarget && onRemoveFromSessionOnly && onRemoveFromRoutine && (
        <RemoveExerciseSheet
          exerciseName={removeTarget.entry.exercise.name}
          onJustToday={() => {
            onRemoveFromSessionOnly(removeTarget.entry, removeTarget.index)
            setRemoveTarget(null)
          }}
          onFromRoutine={() => {
            onRemoveFromRoutine(removeTarget.entry, removeTarget.index)
            setRemoveTarget(null)
          }}
          onClose={() => setRemoveTarget(null)}
        />
      )}

      {detailExercise && (
        <ExerciseDetailSheet
          exercise={detailExercise}
          inProgram={true}
          onClose={() => setDetailExercise(null)}
        />
      )}
    </div>
  )
}
