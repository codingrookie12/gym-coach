'use client'

import { useMemo, useRef, useState } from 'react'
import { ExerciseDefinition, filterExercises, getAlternatives, getUniqueEquipment } from '@/lib/exerciseLibrary'
import ExerciseDetailSheet from '@/components/ExerciseDetailSheet'

interface ExercisePickerSheetProps {
  split: string
  splitMuscles?: string[]
  excludeNames: string[]
  swapTarget?: ExerciseDefinition
  onSelect: (exercise: ExerciseDefinition) => void
  onClose: () => void
  title?: string
}

function PickerRow({
  exercise,
  excluded,
  onSelect,
  onInfo,
}: {
  exercise: ExerciseDefinition
  excluded: boolean
  onSelect: () => void
  onInfo: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
      {/* Info button — separate from main tappable to avoid nested buttons */}
      <button
        onClick={onInfo}
        style={{
          background: 'none', border: 'none',
          color: 'var(--text-secondary)', cursor: 'pointer',
          padding: '13px 8px 13px 20px', flexShrink: 0, lineHeight: 1,
          display: 'flex', alignItems: 'center',
          transition: 'color 0.1s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-mid)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </button>

      {/* Main tappable area — name, tags, AND +/✓ indicator all inside the button */}
      <button
        onClick={excluded ? undefined : onSelect}
        disabled={excluded}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '13px 16px 13px 8px',
          background: 'none',
          border: 'none',
          textAlign: 'left',
          cursor: excluded ? 'default' : 'pointer',
          opacity: excluded ? 0.4 : 1,
          minWidth: 0,
          transition: 'background 0.1s',
        }}
        onMouseDown={e => { if (!excluded) e.currentTarget.style.background = 'rgba(212,241,58,0.04)' }}
        onMouseUp={e => { e.currentTarget.style.background = 'none' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
        onTouchStart={e => { if (!excluded) e.currentTarget.style.background = 'rgba(212,241,58,0.04)' }}
        onTouchEnd={e => { e.currentTarget.style.background = 'none' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-body" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.3, marginBottom: '3px' }}>
            {exercise.name}
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <span className="tag">{exercise.equipment}</span>
            {exercise.primaryMuscles.slice(0, 1).map(m => (
              <span key={m} className="tag">{m}</span>
            ))}
          </div>
        </div>
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {excluded ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </span>
      </button>
    </div>
  )
}

export default function ExercisePickerSheet({
  split,
  splitMuscles = [],
  excludeNames,
  swapTarget,
  onSelect,
  onClose,
  title,
}: ExercisePickerSheetProps) {
  const [query, setQuery] = useState('')
  const [detailExercise, setDetailExercise] = useState<ExerciseDefinition | null>(null)
  const [pendingSelection, setPendingSelection] = useState<ExerciseDefinition | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const resolvedTitle = title ?? (swapTarget ? `SWAP ${swapTarget.name.toUpperCase()}` : 'ADD EXERCISE')

  const suggested = useMemo(() => {
    if (swapTarget) {
      return getAlternatives(swapTarget, {
        availableEquipment: getUniqueEquipment(),
        excludeNames,
        limit: 8,
      })
    }
    if (splitMuscles.length > 0) {
      return filterExercises({ excludeNames })
        .filter(ex => splitMuscles.some(m => ex.primaryMuscles.some(pm => pm.toLowerCase() === m.toLowerCase())))
        .slice(0, 8)
    }
    return filterExercises({ excludeNames }).slice(0, 8)
  }, [swapTarget, splitMuscles, excludeNames])

  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    return filterExercises({ query: query.trim() }).slice(0, 30)
  }, [query])

  const isSearching = query.trim().length > 0

  const suggestedLabel = swapTarget
    ? `ALTERNATIVES — ${swapTarget.primaryMuscles[0]?.toUpperCase() ?? split.toUpperCase()}`
    : `SUGGESTED — ${split.toUpperCase()}`

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
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-2)' }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 20px 12px', flexShrink: 0,
          }}
        >
          <span className="font-display" style={{ fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '0.06em' }}>
            {resolvedTitle}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontSize: '1.1rem', padding: '4px', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding: '0 16px 10px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search exercises..."
              className="input-field"
              style={{ paddingLeft: '36px', paddingRight: query ? '36px' : '12px' }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus() }}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                  fontSize: '1rem', padding: '0', lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="scroll-area" style={{ flex: 1, minHeight: 0 }}>
          {isSearching ? (
            <>
              <div style={{ padding: '8px 20px 4px' }}>
                <span className="section-label">{searchResults.length} RESULT{searchResults.length !== 1 ? 'S' : ''}</span>
              </div>
              {searchResults.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                  <div className="font-display" style={{ fontSize: '1rem', color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    NO RESULTS
                  </div>
                  <div className="font-body" style={{ fontSize: '0.8rem', color: 'var(--border-2)' }}>
                    Try a different name
                  </div>
                </div>
              ) : (
                searchResults.map(ex => (
                  <PickerRow
                    key={ex.id}
                    exercise={ex}
                    excluded={excludeNames.includes(ex.name)}
                    onSelect={() => setPendingSelection(ex)}
                    onInfo={() => setDetailExercise(ex)}
                  />
                ))
              )}
            </>
          ) : (
            <>
              <div style={{ padding: '8px 20px 4px' }}>
                <span className="section-label">{suggestedLabel}</span>
              </div>
              {suggested.length === 0 ? (
                <div style={{ padding: '16px 20px' }}>
                  <span className="font-body" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Search above to find exercises
                  </span>
                </div>
              ) : (
                suggested.map(ex => (
                  <PickerRow
                    key={ex.id}
                    exercise={ex}
                    excluded={excludeNames.includes(ex.name)}
                    onSelect={() => setPendingSelection(ex)}
                    onInfo={() => setDetailExercise(ex)}
                  />
                ))
              )}
              <div style={{ padding: '16px 20px' }}>
                <span className="font-body" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Search above to browse all exercises
                </span>
              </div>
            </>
          )}
        </div>

        {/* Confirmation panel — slides up when a row is tapped, before save fires */}
        {pendingSelection && (
          <div
            style={{
              flexShrink: 0,
              padding: '16px 20px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              animation: 'slideUp 0.18s ease',
            }}
          >
            <div>
              <span className="section-label" style={{ color: 'var(--accent)' }}>CONFIRM</span>
              <div className="font-body" style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 500, marginTop: '6px', lineHeight: 1.3 }}>
                {pendingSelection.name}
              </div>
              <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', marginTop: '4px' }}>
                {swapTarget
                  ? `REPLACE ${swapTarget.name.toUpperCase()}`
                  : `ADD TO ${split.toUpperCase()}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setPendingSelection(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'none',
                  border: '1px solid var(--border-2)',
                  borderRadius: '2px',
                  color: 'var(--text-mid)',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '0.7rem',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  transition: 'border-color 0.1s, color 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-mid)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-mid)' }}
              >
                CANCEL
              </button>
              <button
                onClick={() => { onSelect(pendingSelection) }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  borderRadius: '2px',
                  color: 'var(--bg)',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '0.7rem',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                CONFIRM
              </button>
            </div>
          </div>
        )}
      </div>

      {detailExercise && (
        <ExerciseDetailSheet
          exercise={detailExercise}
          inProgram={excludeNames.includes(detailExercise.name)}
          onClose={() => setDetailExercise(null)}
        />
      )}
    </>
  )
}
