'use client'

import { useRef } from 'react'

interface RemoveExerciseSheetProps {
  exerciseName: string
  onJustToday: () => void
  onFromRoutine: () => void
  onClose: () => void
}

/**
 * GYM-95: Bottom-sheet confirmation for pre-session exercise removal.
 * Asks whether the removal applies to today's session only (in-memory plan
 * splice) or to the permanent routine (deferred DB delete via the GYM-94
 * pattern). Same one-shot guard as AddExerciseSheet so a fast double-tap
 * cannot fire both branches.
 */
export default function RemoveExerciseSheet({ exerciseName, onJustToday, onFromRoutine, onClose }: RemoveExerciseSheetProps) {
  const isSubmittingRef = useRef(false)

  function fire(handler: () => void) {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    handler()
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, animation: 'fadeIn 0.15s ease' }}
      />

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
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 16px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-2)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="section-label" style={{ margin: '0 0 2px 0' }}>REMOVE EXERCISE</p>
            <h3 className="font-display" style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0, letterSpacing: '0.04em', lineHeight: 1.15, wordBreak: 'break-word' }}>
              {exerciseName}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        <p className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', margin: '14px 0 18px', letterSpacing: '0.04em', lineHeight: 1.7 }}>
          Skip it for this session only, or take it out of your routine permanently?
        </p>

        <button
          onClick={() => fire(onJustToday)}
          style={{
            width: '100%',
            background: 'var(--accent)',
            color: '#0C0B09',
            border: '1px solid var(--accent)',
            borderRadius: '2px',
            padding: '14px',
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '1rem',
            letterSpacing: '0.1em',
            cursor: 'pointer',
            marginBottom: '10px',
          }}
        >
          JUST TODAY
        </button>

        <button
          onClick={() => fire(onFromRoutine)}
          style={{
            width: '100%',
            background: 'none',
            color: 'var(--rust)',
            border: '1px solid var(--rust-border)',
            borderRadius: '2px',
            padding: '14px',
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '1rem',
            letterSpacing: '0.1em',
            cursor: 'pointer',
          }}
        >
          FROM ROUTINE
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  )
}
