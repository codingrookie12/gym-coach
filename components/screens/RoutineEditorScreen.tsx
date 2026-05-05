'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getProgramById } from '@/lib/programs'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { getOrSeedRoutine } from '@/lib/supabase.queries'
import {
  getUserRoutineForSplit,
  addExerciseToRoutine,
  removeExerciseFromRoutine,
  type RoutineExerciseRow,
} from '@/lib/userRoutine'
import { type ExerciseDefinition, findExerciseByName } from '@/lib/exerciseLibrary'
import ExercisePickerSheet from '@/components/ExercisePickerSheet'

interface RoutineEditorScreenProps {
  programId: string
  userId: string
  onBack: () => void
}

interface PendingDelete {
  exerciseName: string
  split: string
  row: RoutineExerciseRow
  timeoutId: ReturnType<typeof setTimeout>
}

export default function RoutineEditorScreen({ programId, userId, onBack }: RoutineEditorScreenProps) {
  const program = getProgramById(programId)
  const splits = program?.splits ?? ['Push', 'Pull', 'Legs']

  const [activeSplit, setActiveSplit] = useState(splits[0])
  const [exerciseMap, setExerciseMap] = useState<Map<string, RoutineExerciseRow[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [swapTarget, setSwapTarget] = useState<RoutineExerciseRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const pendingDeleteRef = useRef<PendingDelete | null>(null)

  const supabase = useRef(createSupabaseBrowserClient()).current

  useEffect(() => {
    pendingDeleteRef.current = pendingDelete
  }, [pendingDelete])

  useEffect(() => {
    async function load() {
      try {
        await getOrSeedRoutine(supabase as any, userId, programId)
        const entries = await Promise.all(
          splits.map(async split => {
            const rows = await getUserRoutineForSplit(supabase, userId, split)
            return [split, rows] as [string, RoutineExerciseRow[]]
          })
        )
        setExerciseMap(new Map(entries))
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load routine')
        setLoading(false)
      }
    }
    load()
    return () => {
      const pd = pendingDeleteRef.current
      if (pd) {
        clearTimeout(pd.timeoutId)
        removeExerciseFromRoutine(supabase, userId, pd.split, pd.exerciseName).catch(() => {})
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flushPendingDelete = useCallback(() => {
    const pd = pendingDeleteRef.current
    if (!pd) return
    clearTimeout(pd.timeoutId)
    removeExerciseFromRoutine(supabase, userId, pd.split, pd.exerciseName).catch(() => {})
    setPendingDelete(null)
  }, [supabase, userId])

  function handleRemove(exerciseName: string) {
    const rows = exerciseMap.get(activeSplit) ?? []
    const row = rows.find(r => r.exercise_name === exerciseName)
    if (!row) return

    flushPendingDelete()

    setExerciseMap(prev => {
      const next = new Map(prev)
      next.set(activeSplit, (prev.get(activeSplit) ?? []).filter(r => r.exercise_name !== exerciseName))
      return next
    })

    const timeoutId = setTimeout(() => {
      removeExerciseFromRoutine(supabase, userId, activeSplit, exerciseName).catch(() => {
        setExerciseMap(prev => {
          const next = new Map(prev)
          const current = prev.get(activeSplit) ?? []
          next.set(activeSplit, [...current, row].sort((a, b) => a.sort_order - b.sort_order))
          return next
        })
      })
      setPendingDelete(null)
    }, 3000)

    const pd: PendingDelete = { exerciseName, split: activeSplit, row, timeoutId }
    setPendingDelete(pd)
    pendingDeleteRef.current = pd
  }

  function handleUndo() {
    const pd = pendingDeleteRef.current
    if (!pd) return
    clearTimeout(pd.timeoutId)
    setExerciseMap(prev => {
      const next = new Map(prev)
      const current = prev.get(pd.split) ?? []
      next.set(pd.split, [...current, pd.row].sort((a, b) => a.sort_order - b.sort_order))
      return next
    })
    setPendingDelete(null)
    pendingDeleteRef.current = null
  }

  function handleSwitchSplit(split: string) {
    flushPendingDelete()
    setActiveSplit(split)
  }

  async function handleAddExercise(def: ExerciseDefinition) {
    flushPendingDelete()
    setShowPicker(false)
    const rows = exerciseMap.get(activeSplit) ?? []
    const sortOrder = rows.length ? Math.max(...rows.map(r => r.sort_order)) + 1 : 0
    const tempId = `temp-${Date.now()}`
    const tempRow: RoutineExerciseRow = {
      id: tempId,
      exercise_name: def.name,
      notion_name: def.name,
      sets: 3,
      rep_range_min: 8,
      rep_range_max: 12,
      backup_name: null,
      weight_unit: 'lbs',
      weight_convention: null,
      sort_order: sortOrder,
      equipment: def.equipment ?? null,
    }

    setExerciseMap(prev => {
      const next = new Map(prev)
      next.set(activeSplit, [...(prev.get(activeSplit) ?? []), tempRow])
      return next
    })

    try {
      const realRow = await addExerciseToRoutine(supabase, userId, activeSplit, {
        name: def.name,
        equipment: def.equipment ?? undefined,
      }, sortOrder)
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(activeSplit, (prev.get(activeSplit) ?? []).map(r => r.id === tempId ? realRow : r))
        return next
      })
    } catch {
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(activeSplit, (prev.get(activeSplit) ?? []).filter(r => r.id !== tempId))
        return next
      })
    }
  }

  async function handleSwapExercise(target: RoutineExerciseRow, newDef: ExerciseDefinition) {
    flushPendingDelete()
    setSwapTarget(null)
    const tempId = `temp-${Date.now()}`
    const tempRow: RoutineExerciseRow = {
      id: tempId,
      exercise_name: newDef.name,
      notion_name: newDef.name,
      sets: target.sets,
      rep_range_min: target.rep_range_min,
      rep_range_max: target.rep_range_max,
      backup_name: null,
      weight_unit: target.weight_unit,
      weight_convention: target.weight_convention,
      sort_order: target.sort_order,
      equipment: newDef.equipment ?? null,
    }

    // Optimistic replace — keep same position
    setExerciseMap(prev => {
      const next = new Map(prev)
      next.set(activeSplit, (prev.get(activeSplit) ?? []).map(r =>
        r.id === target.id ? tempRow : r
      ))
      return next
    })

    try {
      await removeExerciseFromRoutine(supabase, userId, activeSplit, target.exercise_name)
      const realRow = await addExerciseToRoutine(supabase, userId, activeSplit, {
        name: newDef.name,
        equipment: newDef.equipment ?? undefined,
      }, target.sort_order)
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(activeSplit, (prev.get(activeSplit) ?? []).map(r => r.id === tempId ? realRow : r))
        return next
      })
    } catch {
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(activeSplit, (prev.get(activeSplit) ?? []).map(r =>
          r.id === tempId ? target : r
        ))
        return next
      })
    }
  }

  const currentRows = exerciseMap.get(activeSplit) ?? []
  // In swap mode, exclude all except the target (target itself excluded by getAlternatives)
  const pickerExcludeNames = swapTarget
    ? currentRows.filter(r => r.exercise_name !== swapTarget.exercise_name).map(r => r.exercise_name)
    : currentRows.map(r => r.exercise_name)
  const swapTargetDef = swapTarget ? findExerciseByName(swapTarget.exercise_name) : undefined

  const pickerOpen = showPicker || swapTarget !== null

  if (loading) {
    return (
      <div className="screen-enter flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
        <Header onBack={onBack} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            LOADING...
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="screen-enter flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
        <Header onBack={onBack} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px' }}>
          <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--rust)', letterSpacing: '0.08em' }}>
            {error}
          </span>
          <button
            onClick={() => { setError(null); setLoading(true); window.location.reload() }}
            style={{ background: 'none', border: '1px solid var(--border-2)', color: 'var(--text-mid)', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', padding: '8px 16px', borderRadius: '2px', cursor: 'pointer', letterSpacing: '0.08em' }}
          >
            RETRY
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
      <Header onBack={() => { flushPendingDelete(); onBack() }} />

      {/* Split tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {splits.map(split => (
          <button
            key={split}
            onClick={() => handleSwitchSplit(split)}
            style={{
              flex: splits.length <= 4 ? 1 : undefined,
              flexShrink: 0,
              background: 'none',
              border: 'none',
              borderBottom: activeSplit === split ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '12px 16px 10px',
              color: activeSplit === split ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.58rem',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'color 0.1s, border-color 0.1s',
              whiteSpace: 'nowrap',
            }}
          >
            {split.toUpperCase()}
            <span style={{ marginLeft: '5px', opacity: 0.5 }}>
              {(exerciseMap.get(split) ?? []).length}
            </span>
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="scroll-area" style={{ flex: 1, minHeight: 0 }}>
        {currentRows.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div className="font-display" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: '8px' }}>
              NO EXERCISES
            </div>
            <div className="font-body" style={{ fontSize: '0.85rem', color: 'var(--border-2)' }}>
              Tap + ADD EXERCISE below
            </div>
          </div>
        ) : (
          currentRows.map((row, i) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid var(--border)',
                transition: 'opacity 0.15s',
              }}
            >
              {/* Index */}
              <span
                className="font-mono"
                style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', flexShrink: 0, width: '20px', paddingLeft: '20px' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>

              {/* Tappable row body — opens swap picker */}
              <button
                onClick={() => { flushPendingDelete(); setSwapTarget(row) }}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '3px',
                  padding: '14px 8px 14px 12px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  minWidth: 0,
                  transition: 'background 0.1s',
                }}
                onMouseDown={e => (e.currentTarget.style.background = 'rgba(212,241,58,0.03)')}
                onMouseUp={e => (e.currentTarget.style.background = 'none')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                onTouchStart={e => (e.currentTarget.style.background = 'rgba(212,241,58,0.03)')}
                onTouchEnd={e => (e.currentTarget.style.background = 'none')}
              >
                <span className="font-body" style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.3 }}>
                  {row.exercise_name}
                </span>
                <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
                  {row.sets}×{row.rep_range_min}–{row.rep_range_max} · tap to swap
                </span>
              </button>

              {/* Remove */}
              <button
                onClick={e => { e.stopPropagation(); handleRemove(row.exercise_name) }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '14px 20px 14px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  lineHeight: 1,
                  flexShrink: 0,
                  transition: 'color 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--rust)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))
        )}

        {/* Add exercise button */}
        <button
          onClick={() => setShowPicker(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: 'calc(100% - 40px)',
            margin: '16px 20px',
            padding: '14px',
            background: 'none',
            border: '1px dashed var(--border-2)',
            borderRadius: '2px',
            color: 'var(--text-mid)',
            fontFamily: 'Space Mono, monospace',
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
            cursor: 'pointer',
            transition: 'border-color 0.1s, color 0.1s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.color = 'var(--accent)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border-2)'
            e.currentTarget.style.color = 'var(--text-mid)'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          ADD EXERCISE
        </button>
      </div>

      {/* Undo toast */}
      {pendingDelete && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 20,
            animation: 'slideUp 0.2s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
            {pendingDelete.exerciseName} removed
          </span>
          <button
            onClick={handleUndo}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              padding: '0',
              fontWeight: 700,
            }}
          >
            UNDO
          </button>
        </div>
      )}

      {pickerOpen && (
        <ExercisePickerSheet
          split={activeSplit}
          splitMuscles={program?.splitMuscles[activeSplit] ?? []}
          excludeNames={pickerExcludeNames}
          swapTarget={swapTargetDef}
          onSelect={swapTarget
            ? (def) => handleSwapExercise(swapTarget, def)
            : handleAddExercise
          }
          onClose={() => { setShowPicker(false); setSwapTarget(null) }}
        />
      )}
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div
      className="safe-top flex items-center gap-4 px-5"
      style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
    >
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', padding: '4px' }}
      >
        ←
      </button>
      <span className="font-display" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
        ROUTINE EDITOR
      </span>
    </div>
  )
}
