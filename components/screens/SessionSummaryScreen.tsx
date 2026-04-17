'use client'

import { Split } from '@/lib/routines'
import { ExercisePlan } from '@/lib/coaching'
import { ExerciseLog } from '@/lib/store'
import { SessionRecord } from '@/lib/notion'

interface SessionSummaryScreenProps {
  split: Split
  exerciseLogs: ExerciseLog[]
  plan: ExercisePlan[]
  previousSessions: SessionRecord[]
  onDone: () => void
}

export default function SessionSummaryScreen({
  split, exerciseLogs, plan, previousSessions, onDone,
}: SessionSummaryScreenProps) {
  const progressFlags: string[] = []
  const stallFlags: string[] = []

  for (const item of plan) {
    const log = exerciseLogs.find(l => l.exerciseName === item.exercise.name)
    if (!log) continue
    const completedSets = log.sets.filter(s => s.completed)
    if (!completedSets.length) continue

    const topOfRange = item.exercise.repRange[1]
    const allHitTop = completedSets.every(s => s.reps >= topOfRange)

    if (allHitTop && item.coachingNote?.includes('increase')) {
      progressFlags.push(`${item.exercise.name} — increase weight next session`)
    } else if (completedSets.length > 0 && !allHitTop) {
      const avgReps = completedSets.reduce((a, b) => a + b.reps, 0) / completedSets.length
      if (avgReps < topOfRange * 0.8) {
        stallFlags.push(`${item.exercise.name} — below target range`)
      }
    }
  }

  const totalSets = exerciseLogs.reduce((a, ex) => a + ex.sets.filter(s => s.completed).length, 0)

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100dvh' }}>

      {/* Header */}
      <div
        className="safe-top px-5"
        style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <p className="section-label" style={{ margin: '0 0 4px 0' }}>SESSION COMPLETE</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <h1 className="font-display" style={{ fontSize: '2.4rem', margin: 0, color: 'var(--accent)', letterSpacing: '0.04em', lineHeight: 1 }}>
            {split} Done
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
            <span className="font-display" style={{ fontSize: '1.8rem', color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '0.02em' }}>
              {totalSets}
            </span>
            <span className="section-label">sets logged</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="scroll-area flex-1 px-5 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Full workout log */}
          <div className="card p-4">
            <p className="section-label" style={{ margin: '0 0 12px 0' }}>WORKOUT LOG</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {exerciseLogs.map((ex, exIdx) => {
                const completedSets = ex.sets.filter(s => s.completed)
                if (!completedSets.length) return null
                return (
                  <div key={exIdx}>
                    <p className="font-sans" style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 7px 0', letterSpacing: '0.02em' }}>
                      {ex.exerciseName}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {ex.sets.map((set, si) =>
                        set.completed ? (
                          <span
                            key={si}
                            className="font-mono"
                            style={{
                              fontSize: '0.68rem',
                              color: 'var(--text-mid)',
                              background: 'var(--surface-2)',
                              border: '1px solid var(--border-2)',
                              borderRadius: '2px',
                              padding: '4px 9px',
                            }}
                          >
                            {set.weight}×{set.reps}
                          </span>
                        ) : null
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Next session flags */}
          {(progressFlags.length > 0 || stallFlags.length > 0) && (
            <div className="card p-4">
              <p className="section-label" style={{ margin: '0 0 10px 0' }}>NEXT SESSION</p>
              {progressFlags.map((f, i) => (
                <p key={i} className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--accent)', margin: '0 0 6px 0' }}>
                  ↑ {f}
                </p>
              ))}
              {stallFlags.map((f, i) => (
                <p key={i} className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--rust)', margin: '0 0 6px 0' }}>
                  ⚠ {f}
                </p>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Done CTA */}
      <div
        className="safe-bottom px-5"
        style={{ paddingTop: '14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}
      >
        <button className="btn-secondary" onClick={onDone}>
          DONE
        </button>
      </div>
    </div>
  )
}
