'use client'

import { useState, useEffect, useRef } from 'react'
import { ExerciseDefinition, validateExerciseName } from '@/lib/exerciseLibrary'

export type ValidationState =
  | { status: 'empty' }
  | { status: 'exact'; exercise: ExerciseDefinition }
  | { status: 'close'; matches: ExerciseDefinition[] }
  | { status: 'none'; confirmed: boolean }

interface ExerciseNameInputProps {
  value: string
  onChange: (v: string) => void
  onValidationChange: (state: ValidationState) => void
  placeholder?: string
  autoFocus?: boolean
}

export default function ExerciseNameInput({
  value,
  onChange,
  onValidationChange,
  placeholder = 'Exercise name...',
  autoFocus = false,
}: ExerciseNameInputProps) {
  const [validation, setValidation] = useState<ValidationState>({ status: 'empty' })
  const [confirmed, setConfirmed] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      const next: ValidationState = { status: 'empty' }
      setValidation(next)
      setConfirmed(false)
      onValidationChange(next)
      return
    }

    debounceRef.current = setTimeout(() => {
      const { exactMatch, closeMatches } = validateExerciseName(value.trim())
      let next: ValidationState
      if (exactMatch) {
        next = { status: 'exact', exercise: exactMatch }
        setConfirmed(false)
      } else if (closeMatches.length > 0) {
        next = { status: 'close', matches: closeMatches }
        setConfirmed(false)
      } else {
        next = { status: 'none', confirmed: false }
        setConfirmed(false)
      }
      setValidation(next)
      onValidationChange(next)
    }, 250)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleConfirmToggle() {
    const next = !confirmed
    setConfirmed(next)
    onValidationChange({ status: 'none', confirmed: next })
  }

  function handleSelectMatch(ex: ExerciseDefinition) {
    onChange(ex.name)
    const next: ValidationState = { status: 'exact', exercise: ex }
    setValidation(next)
    onValidationChange(next)
  }

  const borderColor =
    validation.status === 'exact' ? 'var(--accent-border)' :
    validation.status === 'none' ? 'var(--rust-border)' :
    'var(--border)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Input */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-field"
          style={{
            border: `1px solid ${borderColor}`,
            paddingRight: validation.status === 'exact' ? '36px' : '12px',
            transition: 'border-color 0.15s',
          }}
        />
        {validation.status === 'exact' && (
          <span style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--accent)', fontSize: '0.9rem', pointerEvents: 'none',
          }}>✓</span>
        )}
      </div>

      {/* Exact match metadata */}
      {validation.status === 'exact' && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span className="tag">{validation.exercise.equipment}</span>
          {validation.exercise.primaryMuscles.slice(0, 2).map(m => (
            <span key={m} className="tag">{m}</span>
          ))}
          {validation.exercise.split && <span className="tag">{validation.exercise.split}</span>}
        </div>
      )}

      {/* Close matches */}
      {validation.status === 'close' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span className="section-label">DID YOU MEAN</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {validation.matches.map(ex => (
              <button
                key={ex.id}
                onClick={() => handleSelectMatch(ex)}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-2)',
                  borderRadius: '2px',
                  color: 'var(--text-mid)',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '0.6rem',
                  letterSpacing: '0.05em',
                  padding: '5px 10px',
                  cursor: 'pointer',
                  transition: 'border-color 0.1s, color 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-border)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-2)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-mid)'
                }}
              >
                {ex.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No match warning */}
      {validation.status === 'none' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--rust)', margin: 0, letterSpacing: '0.05em' }}>
            ⚠ No matching exercise found
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <div
              onClick={handleConfirmToggle}
              style={{
                width: '16px',
                height: '16px',
                border: `1px solid ${confirmed ? 'var(--accent)' : 'var(--border-2)'}`,
                borderRadius: '2px',
                background: confirmed ? 'var(--accent)' : 'transparent',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.1s',
                cursor: 'pointer',
              }}
            >
              {confirmed && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#0C0B09" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-mid)', letterSpacing: '0.04em', lineHeight: 1.5 }}>
              Add anyway — I&apos;ll complete details after the session
            </span>
          </label>
        </div>
      )}
    </div>
  )
}
