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
  split,
  exerciseLogs,
  plan,
  previousSessions,
  onDone,
}: SessionSummaryScreenProps) {
  // Coaching flags
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

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div
        className="safe-top px-5"
        style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <p className="font-mono-display" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.12em', margin: '0 0 4px 0' }}>
          SESSION COMPLETE
        </p>
        <h1 className="font-mono-display" style={{ fontSize: '1.5rem', fontWeight: 500, margin: 0, color: 'var(--accent)' }}>
          {split} Done ✓
        </h1>
      </div>

      {/* Content */}
      <div className="scroll-area flex-1 px-5 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Full workout log */}
        <div className="card p-4">
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', margin: '0 0 12px 0' }}>
            WORKOUT LOG
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {exerciseLogs.map((ex, exIdx) => {
              const completedSets = ex.sets.filter(s => s.completed)
              if (!completedSets.length) return null
              return (
                <div key={exIdx}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 6px 0', fontWeight: 500 }}>
                    {ex.exerciseName}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {ex.sets.map((set, si) =>
                      set.completed ? (
                        <span
                          key={si}
                          className="font-mono-display"
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: '3px',
                            padding: '3px 8px',
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
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', margin: '0 0 10px 0' }}>
              NEXT SESSION
            </p>
            {progressFlags.map((f, i) => (
              <p key={i} style={{ fontSize: '0.8rem', color: 'var(--accent)', margin: '0 0 6px 0', fontFamily: 'DM Mono, monospace' }}>
                ↑ {f}
              </p>
            ))}
            {stallFlags.map((f, i) => (
              <p key={i} style={{ fontSize: '0.8rem', color: '#ffa500', margin: '0 0 6px 0', fontFamily: 'DM Mono, monospace' }}>
                ⚠ {f}
              </p>
            ))}
          </div>
        )}

      </div>

      {/* Done */}
      <div
        className="safe-bottom px-5"
        style={{ paddingTop: '16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}
      >
        <button
          onClick={onDone}
          style={{
            width: '100%',
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '16px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '0.9rem',
            fontWeight: 500,
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          DONE
        </button>
      </div>
    </div>
  )
}
