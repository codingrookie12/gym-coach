'use client'

import { getAllExercises, Exercise, Split } from '@/lib/routines'
import { findExerciseByName, getAlternatives, getUniqueEquipment } from '@/lib/exerciseLibrary'
import { setExerciseAvailable, resetExerciseAvailability } from '@/lib/exerciseAvailability'

interface ExerciseAvailabilityPanelProps {
  availability: Record<string, boolean>
  onToggle: (exerciseName: string, available: boolean) => void
  onReset: () => void
  onClose: () => void
}

const SPLITS: Split[] = ['Push', 'Pull', 'Legs']

function resolveSubstituteName(exercise: Exercise, unavailable: Record<string, boolean>): string | null {
  const def = findExerciseByName(exercise.name)
  if (!def) return null
  const unavailableNames = Object.entries(unavailable)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  const alts = getAlternatives(def, {
    availableEquipment: getUniqueEquipment(),
    excludeNames: [exercise.name, ...unavailableNames],
    limit: 1,
  })
  return alts[0]?.name ?? null
}

export default function ExerciseAvailabilityPanel({
  availability, onToggle, onReset, onClose,
}: ExerciseAvailabilityPanelProps) {
  const allExercises = getAllExercises()
  const unavailableCount = Object.values(availability).filter(v => !v).length

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

        {/* Exercise list */}
        <div className="scroll-area flex-1" style={{ overflowY: 'auto', padding: '0 0 8px' }}>
          {SPLITS.map(split => {
            const exercises = allExercises.filter(e => e.split === split)
            return (
              <div key={split}>
                <p className="section-label" style={{ padding: '12px 20px 6px', margin: 0, color: 'var(--text-secondary)' }}>
                  {split.toUpperCase()}
                </p>
                {exercises.map(exercise => {
                  const isAvailable = availability[exercise.name] !== false
                  const substitute = !isAvailable ? resolveSubstituteName(exercise, availability) : null

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
                        onClick={() => {
                          const next = !isAvailable
                          setExerciseAvailable(exercise.name, next)
                          onToggle(exercise.name, next)
                        }}
                        style={{
                          width: '44px',
                          height: '24px',
                          borderRadius: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          background: isAvailable ? 'var(--accent)' : 'var(--border-2)',
                          position: 'relative',
                          flexShrink: 0,
                          transition: 'background 0.15s',
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

          {/* Reset */}
          {unavailableCount > 0 && (
            <div style={{ padding: '16px 20px 8px', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  resetExerciseAvailability()
                  onReset()
                }}
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
