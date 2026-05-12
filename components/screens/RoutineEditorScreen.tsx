'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import {
  getUserRoutineForSplit,
  addExerciseToRoutine,
  removeExerciseFromRoutine,
  reorderExercisesInSplit,
  type RoutineExerciseRow,
} from '@/lib/userRoutine'
import { type ExerciseDefinition, findExerciseByName } from '@/lib/exerciseLibrary'
import ExercisePickerSheet from '@/components/ExercisePickerSheet'
import { usePointerReorder } from '@/components/hooks/usePointerReorder'

interface SplitInfo {
  id: string
  name: string
}

interface RoutineEditorScreenProps {
  splits: SplitInfo[]
  userId: string
  splitMuscles?: Record<string, string[]>
  onBack: () => void
}

interface PendingDelete {
  exerciseName: string
  splitId: string
  row: RoutineExerciseRow
  timeoutId: ReturnType<typeof setTimeout>
}

export default function RoutineEditorScreen({ splits, userId, splitMuscles, onBack }: RoutineEditorScreenProps) {
  const [activeSplitId, setActiveSplitId] = useState(splits[0]?.id ?? '')
  const [exerciseMap, setExerciseMap] = useState<Map<string, RoutineExerciseRow[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [swapTarget, setSwapTarget] = useState<RoutineExerciseRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const pendingDeleteRef = useRef<PendingDelete | null>(null)
  const [reorderPending, setReorderPending] = useState(false)
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [reorderSaved, setReorderSaved] = useState(false)

  const supabase = useRef(createSupabaseBrowserClient()).current
  const activeSplit = splits.find(s => s.id === activeSplitId)

  useEffect(() => {
    pendingDeleteRef.current = pendingDelete
  }, [pendingDelete])

  useEffect(() => {
    if (!reorderSaved) return
    const t = setTimeout(() => setReorderSaved(false), 1500)
    return () => clearTimeout(t)
  }, [reorderSaved])

  useEffect(() => {
    async function load() {
      try {
        const entries = await Promise.all(
          splits.map(async split => {
            const rows = await getUserRoutineForSplit(supabase, split.id)
            return [split.id, rows] as [string, RoutineExerciseRow[]]
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
        removeExerciseFromRoutine(supabase, userId, pd.splitId, pd.exerciseName).catch(() => {})
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flushPendingDelete = useCallback(() => {
    const pd = pendingDeleteRef.current
    if (!pd) return
    clearTimeout(pd.timeoutId)
    removeExerciseFromRoutine(supabase, userId, pd.splitId, pd.exerciseName).catch(() => {})
    setPendingDelete(null)
  }, [supabase, userId])

  function handleRemove(exerciseName: string) {
    const rows = exerciseMap.get(activeSplitId) ?? []
    const row = rows.find(r => r.exercise_name === exerciseName)
    if (!row) return

    flushPendingDelete()

    setExerciseMap(prev => {
      const next = new Map(prev)
      next.set(activeSplitId, (prev.get(activeSplitId) ?? []).filter(r => r.exercise_name !== exerciseName))
      return next
    })

    const timeoutId = setTimeout(() => {
      removeExerciseFromRoutine(supabase, userId, activeSplitId, exerciseName).catch(() => {
        setExerciseMap(prev => {
          const next = new Map(prev)
          const current = prev.get(activeSplitId) ?? []
          next.set(activeSplitId, [...current, row].sort((a, b) => a.sort_order - b.sort_order))
          return next
        })
      })
      setPendingDelete(null)
    }, 3000)

    const pd: PendingDelete = { exerciseName, splitId: activeSplitId, row, timeoutId }
    setPendingDelete(pd)
    pendingDeleteRef.current = pd
  }

  function handleUndo() {
    const pd = pendingDeleteRef.current
    if (!pd) return
    clearTimeout(pd.timeoutId)
    setExerciseMap(prev => {
      const next = new Map(prev)
      const current = prev.get(pd.splitId) ?? []
      next.set(pd.splitId, [...current, pd.row].sort((a, b) => a.sort_order - b.sort_order))
      return next
    })
    setPendingDelete(null)
    pendingDeleteRef.current = null
  }

  function handleSwitchSplit(splitId: string) {
    flushPendingDelete()
    setActiveSplitId(splitId)
  }

  async function handleAddExercise(def: ExerciseDefinition) {
    flushPendingDelete()
    setShowPicker(false)
    const rows = exerciseMap.get(activeSplitId) ?? []
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
      next.set(activeSplitId, [...(prev.get(activeSplitId) ?? []), tempRow])
      return next
    })

    try {
      const realRow = await addExerciseToRoutine(supabase, userId, activeSplitId, {
        name: def.name,
        equipment: def.equipment ?? undefined,
      }, sortOrder)
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(activeSplitId, (prev.get(activeSplitId) ?? []).map(r => r.id === tempId ? realRow : r))
        return next
      })
    } catch (err) {
      console.error('handleAddExercise failed:', err)
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(activeSplitId, (prev.get(activeSplitId) ?? []).filter(r => r.id !== tempId))
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

    setExerciseMap(prev => {
      const next = new Map(prev)
      next.set(activeSplitId, (prev.get(activeSplitId) ?? []).map(r =>
        r.id === target.id ? tempRow : r
      ))
      return next
    })

    try {
      await removeExerciseFromRoutine(supabase, userId, activeSplitId, target.exercise_name)
      const realRow = await addExerciseToRoutine(supabase, userId, activeSplitId, {
        name: newDef.name,
        equipment: newDef.equipment ?? undefined,
      }, target.sort_order)
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(activeSplitId, (prev.get(activeSplitId) ?? []).map(r => r.id === tempId ? realRow : r))
        return next
      })
    } catch (err) {
      console.error('handleSwapExercise failed:', err)
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(activeSplitId, (prev.get(activeSplitId) ?? []).map(r =>
          r.id === tempId ? target : r
        ))
        return next
      })
    }
  }

  const currentRows = useMemo(
    () => exerciseMap.get(activeSplitId) ?? [],
    [exerciseMap, activeSplitId]
  )

  const applyReorder = useCallback(async (newOrder: RoutineExerciseRow[]) => {
    const snapshot = currentRows
    if (newOrder.length !== snapshot.length) return
    if (newOrder.every((r, i) => r.id === snapshot[i].id)) return

    flushPendingDelete()
    setReorderPending(true)
    // Optimistic: flip the visual order immediately, but keep original sort_order
    // values on the rows. The refetch below is the source of truth.
    setExerciseMap(prev => {
      const next = new Map(prev)
      next.set(activeSplitId, newOrder.slice())
      return next
    })

    let rpcError: unknown = null
    try {
      await reorderExercisesInSplit(supabase, activeSplitId, newOrder.map(r => r.id))
    } catch (err) {
      rpcError = err
      console.error('reorderExercisesInSplit failed:', err)
    }

    try {
      const refreshed = await getUserRoutineForSplit(supabase, activeSplitId)
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(activeSplitId, refreshed)
        return next
      })
    } catch (refetchErr) {
      if (!rpcError) rpcError = refetchErr
      // If refetch fails too, fall back to the pre-reorder snapshot so the
      // UI doesn't get stuck displaying a state we can't verify.
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(activeSplitId, snapshot)
        return next
      })
    }

    if (rpcError) {
      setReorderError(rpcError instanceof Error ? rpcError.message : 'Reorder failed')
    } else {
      setReorderSaved(true)
    }
    setReorderPending(false)
  }, [activeSplitId, currentRows, flushPendingDelete, supabase])

  const move = useCallback((index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= currentRows.length) return
    const next = currentRows.slice()
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    applyReorder(next)
  }, [currentRows, applyReorder])

  const reorder = usePointerReorder<RoutineExerciseRow>({
    items: currentRows,
    getId: row => row.id,
    onReorder: applyReorder,
    disabled: reorderPending || pendingDelete !== null,
  })

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
            key={split.id}
            onClick={() => handleSwitchSplit(split.id)}
            style={{
              flex: splits.length <= 4 ? 1 : undefined,
              flexShrink: 0,
              background: 'none',
              border: 'none',
              borderBottom: activeSplitId === split.id ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '12px 16px 10px',
              color: activeSplitId === split.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.58rem',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'color 0.1s, border-color 0.1s',
              whiteSpace: 'nowrap',
            }}
          >
            {split.name.toUpperCase()}
            <span style={{ marginLeft: '5px', opacity: 0.5 }}>
              {(exerciseMap.get(split.id) ?? []).length}
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
          currentRows.map((row, i) => {
            const isDragging = reorder.dragId === row.id
            const offset = reorder.getRowOffset(i)
            const upDisabled = i === 0 || reorderPending
            const downDisabled = i === currentRows.length - 1 || reorderPending
            return (
            <div
              key={row.id}
              ref={reorder.registerRow(row.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid var(--border)',
                transition: isDragging ? 'none' : 'transform 0.15s, opacity 0.15s',
                transform: `translateY(${offset}px)`,
                zIndex: isDragging ? 10 : undefined,
                position: 'relative',
                background: isDragging ? 'var(--surface)' : undefined,
                boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.4)' : undefined,
                opacity: reorderPending && !isDragging ? 0.55 : 1,
                pointerEvents: reorderPending ? 'none' : undefined,
                touchAction: 'pan-y',
              }}
            >
              {/* Drag handle */}
              <button
                type="button"
                aria-label="Drag to reorder"
                onPointerDown={reorder.handlePointerDown(row.id)}
                disabled={reorderPending || pendingDelete !== null}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  padding: '14px 6px 14px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  touchAction: 'none',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </svg>
              </button>

              {/* Index */}
              <span
                className="font-mono"
                style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', flexShrink: 0, width: '20px' }}
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

              {/* Move up */}
              <button
                type="button"
                aria-label="Move up"
                onClick={e => { e.stopPropagation(); move(i, -1) }}
                disabled={upDisabled}
                style={{
                  background: 'none',
                  border: 'none',
                  color: upDisabled ? 'var(--border-2)' : 'var(--text-secondary)',
                  cursor: upDisabled ? 'default' : 'pointer',
                  padding: '14px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 14 12 8 18 14" />
                </svg>
              </button>

              {/* Move down */}
              <button
                type="button"
                aria-label="Move down"
                onClick={e => { e.stopPropagation(); move(i, 1) }}
                disabled={downDisabled}
                style={{
                  background: 'none',
                  border: 'none',
                  color: downDisabled ? 'var(--border-2)' : 'var(--text-secondary)',
                  cursor: downDisabled ? 'default' : 'pointer',
                  padding: '14px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 10 12 16 18 10" />
                </svg>
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
            )
          })
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

      {reorderSaved && !reorderError && (
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
            border: '1px solid var(--accent)',
            borderRadius: '4px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 20,
            animation: 'slideUp 0.2s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--accent)', letterSpacing: '0.08em' }}>
            ORDER SAVED
          </span>
        </div>
      )}

      {reorderError && (
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
            border: '1px solid var(--rust)',
            borderRadius: '4px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 20,
            whiteSpace: 'nowrap',
          }}
        >
          <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--rust)', letterSpacing: '0.06em' }}>
            Reorder failed
          </span>
          <button
            onClick={() => setReorderError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-mid)',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              padding: '0',
              fontWeight: 700,
            }}
          >
            DISMISS
          </button>
        </div>
      )}

      {pickerOpen && activeSplit && (
        <ExercisePickerSheet
          split={activeSplit.name}
          splitMuscles={splitMuscles?.[activeSplit.name] ?? []}
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
