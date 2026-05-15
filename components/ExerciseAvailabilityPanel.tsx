'use client'

import { useState } from 'react'
import { getAllExercises, Exercise, Split } from '@/lib/routines'
import { findExerciseByName, getAlternatives, getUniqueEquipment } from '@/lib/exerciseLibrary'
import {
  setExerciseAvailable,
  resetExerciseAvailability,
  AvailabilityState,
} from '@/lib/exerciseAvailability'

interface ExerciseAvailabilityPanelProps {
  availability: AvailabilityState
  onToggle: (exerciseName: string, available: boolean) => void
  onReset: () => void
  onClose: () => void
}

const SPLITS: Split[] = ['Push', 'Pull', 'Legs']

function resolveSubstituteName(exercise: Exercise, unavailable: Set<string>): string | null {
  const def = findExerciseByName(exercise.name)
  if (!def) return null
  const alts = getAlternatives(def, {
    availableEquipment: getUniqueEquipment(),
    excludeNames: [exercise.name, ...Array.from(unavailable)],
    limit: 1,
  })
  return alts[0]?.name ?? null
}

export default function ExerciseAvailabilityPanel({
  availability, onToggle, onReset, onClose,
}: ExerciseAvailabilityPanelProps) {
  const { unavailable, trainedEquipment, trainedExercises } = availability
  const allExercises = getAllExercises()
  const unavailableCount = unavailable.size
  const [pending, setPending] = useState<Set<string>>(new Set())

  // YOUR GYM filter: exercises whose equipment is in trainedEquipment, plus any
  // exercise the user has trained directly (handles equipment used once but not
  // captured in the equipment dimension). First-time users (no history) get ALL.
  const hasHistory = trainedEquipment.size > 0 || trainedExercises.size > 0
  const [filterMode, setFilterMode] = useState<'mine' | 'all'>(hasHistory ? 'mine' : 'all')

  const visibleExercises = filterMode === 'all'
    ? allExercises
    : allExercises.filter(ex => {
        if (trainedExercises.has(ex.name)) return true
        const def = findExerciseByName(ex.name)
        return def?.equipment ? trainedEquipment.has(def.equipment) : false
      })

  async function handleToggle(name: string, next: boolean) {
    if (pending.has(name)) return
    setPending(prev => {
      const s = new Set(prev)
      s.add(name)
      return s
    })
    try {
      await setExerciseAvailable(name, next)
      onToggle(name, next)
    } catch (err) {
      console.error('Availability toggle failed:', err)
    } finally {
      setPending(prev => {
        const s = new Set(prev)
        s.delete(name)
        return s
      })
    }
  }

  async function handleReset() {
    try {
      await resetExerciseAvailability()
      onReset()
    } catch (err) {
      console.error('Availability reset failed:', err)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          borderRadius: '12px 12px 0 0',
          maxHeight: '80dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: '36px', height: '3px', borderRadius: '2px', background: 'var(--border-2)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <p className="section-label" style={{ margin: '0 0 2px' }}>EQUIPMENT AVAILABILITY</p>
            <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-mid)', margin: 0 }}>
              {unavailableCount === 0 ? 'All equipment available' : `${unavailableCount} exercise${unavailableCount > 1 ? 's' : ''} marked unavailable`}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontSize: '1.1rem', padding: '4px 8px', fontFamily: 'Space Mono, monospace' }}
          >
            ×
          </button>
        </div>

        {/* Filter toggle */}
        {hasHistory && (
          <div style={{ display: 'flex', gap: '6px', padding: '10px 20px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {(['mine', 'all'] as const).map(m => (
              <button
                key={m}
                onClick={() => setFilterMode(m)}
                style={{
                  background: filterMode === m ? 'var(--accent)' : 'var(--surface-2)',
                  color: filterMode === m ? '#0C0B09' : 'var(--text-secondary)',
                  border: `1px solid ${filterMode === m ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '2px',
                  padding: '5px 12px',
                  fontFamily: 'Bebas Neue, sans-serif',
                  fontSize: '0.8rem',
                  fontWeight: filterMode === m ? 700 : 400,
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
              >
                {m === 'mine' ? 'YOUR GYM' : 'ALL'}
              </button>
            ))}
          </div>
        )}

        {/* Exercise list */}
        <div className="scroll-area flex-1" style={{ overflowY: 'auto', padding: '0 0 8px' }}>
          {SPLITS.map(split => {
            const exercises = visibleExercises.filter(e => e.split === split)
            if (exercises.length === 0) return null
            return (
              <div key={split}>
                <p className="section-label" style={{ padding: '12px 20px 6px', margin: 0, color: 'var(--text-secondary)' }}>
                  {split.toUpperCase()}
                </p>
                {exercises.map(exercise => {
                  const isAvailable = !unavailable.has(exercise.name)
                  const substitute = !isAvailable ? resolveSubstituteName(exercise, unavailable) : null
                  const isPending = pending.has(exercise.name)

                  return (
                    <div
                      key={exercise.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 20px',
                        borderBottom: '1px solid var(--border)',
                        gap: '12px',
                        opacity: isAvailable ? 1 : 0.6,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          className="font-sans"
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            color: isAvailable ? 'var(--text-primary)' : 'var(--text-mid)',
                            margin: '0 0 2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {exercise.name}
                        </p>
                        {!isAvailable && (
                          <p className="font-mono" style={{ fontSize: '0.58rem', color: substitute ? 'var(--accent)' : 'var(--rust)', margin: 0 }}>
                            {substitute ? `→ ${substitute}` : 'No substitute available'}
                          </p>
                        )}
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(exercise.name, !isAvailable)}
                        disabled={isPending}
                        style={{
                          width: '44px',
                          height: '24px',
                          borderRadius: '12px',
                          border: 'none',
                          cursor: isPending ? 'wait' : 'pointer',
                          background: isAvailable ? 'var(--accent)' : 'var(--border-2)',
                          opacity: isPending ? 0.5 : 1,
                          position: 'relative',
                          flexShrink: 0,
                          transition: 'background 0.15s, opacity 0.15s',
                        }}
                        aria-label={isAvailable ? 'Mark unavailable' : 'Mark available'}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: '3px',
                            left: isAvailable ? '23px' : '3px',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: 'var(--bg)',
                            transition: 'left 0.15s',
                          }}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Empty state when YOUR GYM filter produced no matches */}
          {visibleExercises.length === 0 && (
            <div style={{ padding: '24px 20px', textAlign: 'center' }}>
              <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-mid)', margin: 0 }}>
                No trained exercises yet — switch to ALL to mark unavailable items.
              </p>
            </div>
          )}

          {/* Reset */}
          {unavailableCount > 0 && (
            <div style={{ padding: '16px 20px 8px', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={handleReset}
                className="font-mono"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-mid)',
                  cursor: 'pointer',
                  fontSize: '0.65rem',
                  letterSpacing: '0.08em',
                  textDecoration: 'underline',
                }}
              >
                RESET ALL TO AVAILABLE
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
