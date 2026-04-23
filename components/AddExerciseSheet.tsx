'use client'

import { useState, useEffect } from 'react'
import ExerciseNameInput, { ValidationState } from './ExerciseNameInput'
import { ExerciseDefinition } from '@/lib/exerciseLibrary'

interface AddExerciseSheetProps {
  onAdd: (name: string, matched: ExerciseDefinition | null, prefillWeight: number | null, prefillReps: number | null) => void
  onClose: () => void
}

export default function AddExerciseSheet({ onAdd, onClose }: AddExerciseSheetProps) {
  const [name, setName] = useState('')
  const [validation, setValidation] = useState<ValidationState>({ status: 'empty' })
  const [prefillWeight, setPrefillWeight] = useState<number | null>(null)
  const [prefillReps, setPrefillReps] = useState<number | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    if (validation.status !== 'exact' || !validation.exercise.split) {
      setPrefillWeight(null)
      setPrefillReps(null)
      return
    }

    const { name: exName, split } = validation.exercise
    setLoadingHistory(true)
    fetch(`/api/weights/exercise?name=${encodeURIComponent(exName)}&split=${encodeURIComponent(split)}`)
      .then(r => r.json())
      .then(d => {
        setPrefillWeight(d.weight ?? null)
        setPrefillReps(d.reps ?? null)
      })
      .catch(() => {
        setPrefillWeight(null)
        setPrefillReps(null)
      })
      .finally(() => setLoadingHistory(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validation.status === 'exact' ? validation.exercise.name : null])

  const canAdd =
    validation.status === 'exact' ||
    (validation.status === 'none' && validation.confirmed)

  const isCustom = validation.status === 'none' && validation.confirmed

  function handleAdd() {
    if (!canAdd) return
    const matched = validation.status === 'exact' ? validation.exercise : null
    onAdd(name.trim(), matched, prefillWeight, prefillReps)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, animation: 'fadeIn 0.15s ease' }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          borderRadius: '8px 8px 0 0',
          zIndex: 50,
          padding: '0 20px 40px',
          animation: 'slideUp 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 16px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-2)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <p className="section-label" style={{ margin: '0 0 2px 0' }}>ADD EXERCISE</p>
            <h3 className="font-display" style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0, letterSpacing: '0.04em', lineHeight: 1 }}>
              Quick Add
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}
          >
            ✕
          </button>
        </div>

        {/* Input */}
        <ExerciseNameInput
          value={name}
          onChange={setName}
          onValidationChange={setValidation}
          autoFocus
        />

        {/* History prefill */}
        {validation.status === 'exact' && (
          <p className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', margin: '10px 0 0', letterSpacing: '0.04em' }}>
            {loadingHistory
              ? 'Checking history...'
              : prefillWeight !== null
                ? `Last used: ${prefillWeight} lbs × ${prefillReps ?? '?'} reps`
                : 'No history found'}
          </p>
        )}

        {/* Custom notice */}
        {isCustom && (
          <p className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', margin: '12px 0 0', letterSpacing: '0.04em', lineHeight: 1.6 }}>
            This exercise will be added to your session. After the workout, you&apos;ll be prompted to complete its details so it can be saved to your library.
          </p>
        )}

        {/* CTA */}
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          style={{
            marginTop: '20px',
            width: '100%',
            background: canAdd ? 'var(--accent)' : 'var(--surface-2)',
            color: canAdd ? '#0C0B09' : 'var(--text-secondary)',
            border: `1px solid ${canAdd ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '2px',
            padding: '14px',
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '1rem',
            letterSpacing: '0.1em',
            cursor: canAdd ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          ADD TO SESSION
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  )
}
