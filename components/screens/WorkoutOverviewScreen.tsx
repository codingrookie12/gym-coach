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
        style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem', padding: '4px' }}
        >
          ←
        </button>
        <div>
          <p className="font-mono-display" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.12em', margin: 0 }}>SESSION PLAN</p>
          <h1 className="font-mono-display" style={{ fontSize: '1.25rem', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>
            {split} — {plan.length} exercises
          </h1>
        </div>
      </div>

      {/* Exercise list */}
      <div className="scroll-area flex-1 px-5 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {plan.map((item, i) => {
          const isSwapped = swappedIndex === i
          return (
            <div key={i} className="card p-4" style={{ transition: 'all 0.15s' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono-display" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {item.exercise.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <span className="font-mono-display" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {item.exercise.sets} sets
                    </span>
                    <span className="font-mono-display" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {item.exercise.repRange[0] === item.exercise.repRange[1]
                        ? `${item.exercise.repRange[0]} reps`
                        : `${item.exercise.repRange[0]}–${item.exercise.repRange[1]} reps`}
                    </span>
                    {item.targetWeight !== null ? (
                      <span className="font-mono-display" style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>
                        {item.targetWeight} lbs
                      </span>
                    ) : (
                      <span className="font-mono-display" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        no weight logged
                      </span>
                    )}
                  </div>
                  {item.coachingNote && (
                    <p style={{ fontSize: '0.7rem', color: 'var(--accent)', margin: '6px 0 0 0', fontFamily: 'DM Mono, monospace', opacity: 0.8 }}>
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

              {/* Backup exercise (expanded) */}
              {isSwapped && (
                <div
                  style={{
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em' }}>
                    BACKUP:
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {item.exercise.backup}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Cardio recommendation */}
      <div className="px-5 pb-3" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(200,241,53,0.04)', border: '1px solid rgba(200,241,53,0.15)', borderRadius: '4px' }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', flexShrink: 0 }}>CARDIO</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{cardio}</span>
        </div>
      </div>

      {/* Begin / Resume CTA */}
      <div
        className="safe-bottom px-5"
        style={{ paddingTop: '16px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        {hasResumable && onResume && (
          <button
            onClick={onResume}
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
            RESUME SESSION →
          </button>
        )}
        <button
          onClick={onBegin}
          style={{
            width: '100%',
            background: hasResumable ? 'none' : 'var(--accent)',
            color: hasResumable ? 'var(--text-secondary)' : '#0A0A0A',
            border: hasResumable ? '1px solid var(--border)' : 'none',
            borderRadius: '4px',
            padding: '16px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '0.9rem',
            fontWeight: hasResumable ? 400 : 600,
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          {hasResumable ? 'START FRESH' : 'BEGIN WORKOUT →'}
        </button>
      </div>
    </div>
  )
}
