'use client'

import { ExerciseDefinition } from '@/lib/exerciseLibrary'

export const EXERCISE_CDN = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

export default function ExerciseDetailSheet({
  exercise,
  inProgram,
  onClose,
}: {
  exercise: ExerciseDefinition
  inProgram: boolean
  onClose: () => void
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 40, animation: 'fadeIn 0.15s ease',
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          borderRadius: '8px 8px 0 0',
          zIndex: 50,
          animation: 'slideUp 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
          maxHeight: '80dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-2)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '4px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <h2 className="font-display" style={{ fontSize: '1.4rem', color: 'var(--text-primary)', letterSpacing: '0.04em', margin: 0, lineHeight: 1.1 }}>
                {exercise.name}
              </h2>
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span className="tag">{exercise.equipment}</span>
                {inProgram && <span className="tag accent">In Program</span>}
                {exercise.isCustom && <span className="tag accent">Custom</span>}
                {exercise.split && <span className="tag">{exercise.split}</span>}
                {exercise.level && (
                  <span className="tag" style={{ textTransform: 'capitalize' }}>{exercise.level}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px', flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="scroll-area" style={{ flex: 1, padding: '16px 20px 32px' }}>

          {/* Exercise images — start + end position */}
          {exercise.images && exercise.images.length >= 2 && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {exercise.images.slice(0, 2).map((path, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    borderRadius: '4px',
                    aspectRatio: '4/3',
                    background: 'var(--surface-2)',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={`${EXERCISE_CDN}/${path}`}
                    alt={i === 0 ? 'Start position' : 'End position'}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={e => {
                      const wrapper = e.currentTarget.parentElement
                      if (wrapper) wrapper.style.display = 'none'
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Muscles */}
          <div style={{ marginBottom: '20px' }}>
            <div className="section-label" style={{ marginBottom: '8px' }}>Primary Muscles</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {exercise.primaryMuscles.map(m => (
                <span key={m} className="tag accent">{m}</span>
              ))}
            </div>
          </div>
          {exercise.secondaryMuscles.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div className="section-label" style={{ marginBottom: '8px' }}>Secondary Muscles</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {exercise.secondaryMuscles.map(m => (
                  <span key={m} className="tag">{m}</span>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          {exercise.instructions.length > 0 && (
            <div>
              <div className="section-label" style={{ marginBottom: '10px' }}>Instructions</div>
              <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {exercise.instructions.map((step, i) => (
                  <li key={i} className="font-body" style={{ fontSize: '0.9rem', color: 'var(--text-mid)', lineHeight: 1.5 }}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  )
}
