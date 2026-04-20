'use client'

import { useState } from 'react'
import { Split, CARDIO_RECOMMENDATION } from '@/lib/routines'
import { ExercisePlan } from '@/lib/coaching'

interface WorkoutOverviewScreenProps {
  split: Split
  plan: ExercisePlan[]
  hasResumable?: boolean
  onBegin: () => void
  onResume?: () => void
  onBack: () => void
}

export default function WorkoutOverviewScreen({ split, plan, hasResumable, onBegin, onResume, onBack }: WorkoutOverviewScreenProps) {
  const [swappedIndex, setSwappedIndex] = useState<number | null>(null)
  const cardio = CARDIO_RECOMMENDATION[split]

  function toggleSwap(i: number) {
    setSwappedIndex(prev => prev === i ? null : i)
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
          <p className="section-label" style={{ margin: '0 0 2px 0' }}>SESSION PLAN</p>
          <h1 className="font-display" style={{ fontSize: '1.7rem', margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1 }}>
            {split} Day
          </h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span className="font-display" style={{ fontSize: '1.8rem', color: 'var(--accent)', lineHeight: 1, letterSpacing: '0.02em' }}>
            {plan.length}
          </span>
          <span className="section-label">exercises</span>
        </div>
      </div>

      {/* Exercise list */}
      <div className="scroll-area flex-1 px-5 py-3" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {plan.map((item, i) => {
            const isSwapped = swappedIndex === i
            return (
              <div
                key={i}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderLeft: item.coachingNote ? '3px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: item.coachingNote ? '0 2px 2px 0' : '2px',
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
                      <span className="font-sans" style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '0.02em' }}>
                        {item.exercise.name}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-mid)' }}>
                        {item.exercise.sets} sets
                      </span>
                      <span style={{ color: 'var(--border-2)', fontSize: '0.6rem' }}>·</span>
                      <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-mid)' }}>
                        {item.exercise.repRange[0] === item.exercise.repRange[1]
                          ? `${item.exercise.repRange[0]} reps`
                          : `${item.exercise.repRange[0]}–${item.exercise.repRange[1]} reps`}
                      </span>
                      {item.targetWeight !== null ? (
                        <>
                          <span style={{ color: 'var(--border-2)', fontSize: '0.6rem' }}>·</span>
                          <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>
                            {item.targetWeight} lbs
                          </span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: 'var(--border-2)', fontSize: '0.6rem' }}>·</span>
                          <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            no weight logged
                          </span>
                        </>
                      )}
                    </div>

                    {/* Coaching note */}
                    {item.coachingNote && (
                      <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--accent)', margin: '6px 0 0 0', opacity: 0.9 }}>
                        ↑ {item.coachingNote}
                      </p>
                    )}
                  </div>

                  <button
                    className="swap-badge"
                    onClick={() => toggleSwap(i)}
                    style={{ flexShrink: 0, marginTop: '2px' }}
                  >
                    {isSwapped ? 'HIDE' : 'SWAP'}
                  </button>
                </div>

                {/* Backup row */}
                {isSwapped && item.exercise.backup && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="section-label">BACKUP:</span>
                    <span className="font-sans" style={{ fontSize: '0.85rem', color: 'var(--text-mid)', fontWeight: 400 }}>
                      {item.exercise.backup}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Cardio recommendation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: '2px', marginTop: '4px' }}>
          <span className="section-label" style={{ color: 'var(--accent)', flexShrink: 0 }}>CARDIO</span>
          <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-mid)' }}>{cardio}</span>
        </div>
      </div>

      {/* CTA */}
      <div
        className="safe-bottom px-5"
        style={{ paddingTop: '14px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        {hasResumable && onResume && (
          <button className="btn-primary" onClick={onResume}>
            RESUME SESSION →
          </button>
        )}
        <button
          onClick={onBegin}
          className={hasResumable ? 'btn-secondary' : 'btn-primary'}
        >
          {hasResumable ? 'START FRESH' : 'BEGIN WORKOUT →'}
        </button>
      </div>
    </div>
  )
}
