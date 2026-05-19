'use client'

import { useState, useEffect } from 'react'
import { ExercisePlan } from '@/lib/coaching'
import { ExerciseLog } from '@/lib/store'
import { SessionRecord } from '@/lib/supabase.queries'
import { Equipment, Muscle } from '@/lib/exerciseLibrary'
import {
  getPendingExercises,
  completeExerciseMetadata,
  PendingExercise,
} from '@/lib/customExercises'
import ExerciseMetadataFields from '@/components/ExerciseMetadataFields'

interface SessionSummaryScreenProps {
  userId: string
  split: string
  exerciseLogs: ExerciseLog[]
  plan: ExercisePlan[]
  previousSessions: SessionRecord[]
  syncStatus?: 'confirmed' | 'partial' | 'queued'
  onDone: () => void
}

function MetadataSheet({
  exercise,
  onSave,
  onSkip,
}: {
  exercise: PendingExercise
  onSave: (name: string, equipment: Equipment, muscles: Muscle[], split: string | null) => void
  onSkip: () => void
}) {
  const [equipment, setEquipment] = useState<Equipment | ''>('')
  const [muscles, setMuscles] = useState<Muscle[]>([])
  const [split, setSplit] = useState<string>('None')

  const canSave = equipment !== '' && muscles.length > 0

  return (
    <>
      <div onClick={onSkip} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        borderRadius: '8px 8px 0 0',
        zIndex: 50,
        padding: '0 20px 40px',
        maxHeight: '85dvh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 16px', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-2)' }} />
        </div>

        <div style={{ flexShrink: 0, marginBottom: '16px' }}>
          <p className="section-label" style={{ margin: '0 0 2px 0' }}>COMPLETE EXERCISE</p>
          <h3 className="font-display" style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0, letterSpacing: '0.04em', lineHeight: 1 }}>
            {exercise.name}
          </h3>
          <p className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', margin: '6px 0 0', letterSpacing: '0.04em' }}>
            Add details to save to your exercise library
          </p>
        </div>

        <div className="scroll-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '16px' }}>
          <ExerciseMetadataFields
            equipment={equipment}
            setEquipment={setEquipment}
            muscles={muscles}
            setMuscles={setMuscles}
            split={split}
            setSplit={setSplit}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexShrink: 0, paddingTop: '12px' }}>
          <button
            onClick={onSkip}
            style={{
              flex: 1,
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '2px',
              color: 'var(--text-secondary)',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              padding: '12px',
              cursor: 'pointer',
            }}
          >
            LATER
          </button>
          <button
            onClick={() => canSave && onSave(
              exercise.name,
              equipment as Equipment,
              muscles,
              split === 'None' ? null : split,
            )}
            disabled={!canSave}
            style={{
              flex: 2,
              background: canSave ? 'var(--accent)' : 'var(--surface-2)',
              border: `1px solid ${canSave ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '2px',
              color: canSave ? '#0C0B09' : 'var(--text-secondary)',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: '1rem',
              letterSpacing: '0.1em',
              padding: '12px',
              cursor: canSave ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            SAVE TO LIBRARY
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </>
  )
}

export default function SessionSummaryScreen({
  userId, split, exerciseLogs, plan, previousSessions, syncStatus, onDone,
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

  // Custom exercise metadata prompt
  const customNames = exerciseLogs.filter(l => l.isCustom).map(l => l.exerciseName)
  const [pendingForSession, setPendingForSession] = useState<PendingExercise[]>([])
  const [metadataIdx, setMetadataIdx] = useState(0)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (customNames.length === 0) return
    let cancelled = false
    getPendingExercises(userId).then(all => {
      if (cancelled) return
      const relevant = all.filter(e => !e.metadataComplete && customNames.includes(e.name))
      setPendingForSession(relevant)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSaveMetadata(name: string, equipment: Equipment, muscles: Muscle[], s: string | null) {
    await completeExerciseMetadata(userId, name, { equipment, primaryMuscles: muscles, split: s })
    const next = metadataIdx + 1
    if (next < pendingForSession.length) {
      setMetadataIdx(next)
    } else {
      setSheetOpen(false)
      setPendingForSession([])
    }
  }

  function handleSkipMetadata() {
    setSheetOpen(false)
  }

  const showBanner = pendingForSession.length > 0 && !bannerDismissed && !sheetOpen

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100dvh' }}>

      {/* Header */}
      <div
        className="safe-top px-5"
        style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <p className="section-label" style={{ margin: '0 0 4px 0' }}>SESSION COMPLETE</p>
        {syncStatus === 'confirmed' && (
          <p className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', margin: '0 0 8px 0', letterSpacing: '0.1em' }}>
            ✓ SAVED TO HISTORY
          </p>
        )}
        {syncStatus === 'partial' && (
          <p className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--rust)', margin: '0 0 8px 0', letterSpacing: '0.1em' }}>
            ⚠ PARTIAL SYNC — queued for auto-retry
          </p>
        )}
        {syncStatus === 'queued' && (
          <p className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--rust)', margin: '0 0 8px 0', letterSpacing: '0.1em' }}>
            SAVED ON DEVICE — will sync to your account when you&apos;re back online.
          </p>
        )}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
                      <p className="font-sans" style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '0.02em' }}>
                        {ex.exerciseName}
                      </p>
                      {ex.isCustom && (
                        <span className="tag" style={{ color: 'var(--text-secondary)', fontSize: '0.5rem' }}>CUSTOM</span>
                      )}
                    </div>
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

          {/* Custom exercise banner */}
          {showBanner && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border-2)',
              borderLeft: '3px solid var(--accent)',
              borderRadius: '0 2px 2px 0',
            }}>
              <div>
                <p className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--accent)', margin: '0 0 2px 0', letterSpacing: '0.05em' }}>
                  {pendingForSession.length === 1 ? '1 CUSTOM EXERCISE' : `${pendingForSession.length} CUSTOM EXERCISES`}
                </p>
                <p className="font-body" style={{ fontSize: '0.82rem', color: 'var(--text-mid)', margin: 0 }}>
                  Add details to save to your library
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={() => setBannerDismissed(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.08em', padding: '4px', cursor: 'pointer' }}
                >
                  LATER
                </button>
                <button
                  onClick={() => setSheetOpen(true)}
                  style={{
                    background: 'var(--accent-dim)',
                    border: '1px solid var(--accent-border)',
                    borderRadius: '2px',
                    color: 'var(--accent)',
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '0.6rem',
                    letterSpacing: '0.06em',
                    padding: '6px 10px',
                    cursor: 'pointer',
                  }}
                >
                  ADD DETAILS
                </button>
              </div>
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

      {/* Metadata sheet */}
      {sheetOpen && pendingForSession[metadataIdx] && (
        <MetadataSheet
          exercise={pendingForSession[metadataIdx]}
          onSave={handleSaveMetadata}
          onSkip={handleSkipMetadata}
        />
      )}
    </div>
  )
}
