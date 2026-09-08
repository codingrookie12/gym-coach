'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import {
  getUserRoutineForSplit,
  addExerciseToRoutine,
  removeExerciseFromRoutine,
  swapExerciseInRoutine,
  type RoutineExerciseRow,
} from '@/lib/userRoutine'
import { type ExerciseDefinition, findExerciseByName } from '@/lib/exerciseLibrary'
import ExercisePickerSheet from '@/components/ExercisePickerSheet'

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

/**
 * Pending routine mutation that can be undone within a 3s window.
 *
 * GYM-94: Every routine write (add/swap/delete) goes through this pattern.
 * The UI updates optimistically; the DB write is deferred and only commits
 * when the timeout fires (or `flush` is called on navigation). `undo`
 * reverts the optimistic UI and cancels the DB write entirely.
 */
interface PendingOp {
  splitId: string
  message: string
  timeoutId: ReturnType<typeof setTimeout>
  flush: () => Promise<void>
  undo: () => void
}

export default function RoutineEditorScreen({ splits, userId, splitMuscles, onBack }: RoutineEditorScreenProps) {
  const t = useTranslations('screens.routineEditor')
  const [activeSplitId, setActiveSplitId] = useState(splits[0]?.id ?? '')
  const [exerciseMap, setExerciseMap] = useState<Map<string, RoutineExerciseRow[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [swapTarget, setSwapTarget] = useState<RoutineExerciseRow | null>(null)
  const [pendingOp, setPendingOp] = useState<PendingOp | null>(null)
  const pendingOpRef = useRef<PendingOp | null>(null)
  const [reordering, setReordering] = useState(false)
  const [reorderError, setReorderError] = useState<string | null>(null)

  const supabase = useRef(createSupabaseBrowserClient()).current
  const activeSplit = splits.find(s => s.id === activeSplitId)

  useEffect(() => {
    pendingOpRef.current = pendingOp
  }, [pendingOp])

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
        setError(err instanceof Error ? err.message : t('loadFailed'))
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flushPendingOp = useCallback(async () => {
    const op = pendingOpRef.current
    if (!op) return
    clearTimeout(op.timeoutId)
    setPendingOp(null)
    pendingOpRef.current = null
    try {
      await op.flush()
    } catch {
      // op.flush handles its own error recovery (UI rollback)
    }
  }, [])

  const handleBack = useCallback(async () => {
    await flushPendingOp()
    onBack()
  }, [flushPendingOp, onBack])

  function startPendingOp(op: PendingOp) {
    // Replace any in-flight op by flushing it first.
    const prev = pendingOpRef.current
    if (prev) {
      clearTimeout(prev.timeoutId)
      prev.flush().catch(() => {})
    }
    setPendingOp(op)
    pendingOpRef.current = op
  }

  function handleUndo() {
    const op = pendingOpRef.current
    if (!op) return
    clearTimeout(op.timeoutId)
    op.undo()
    setPendingOp(null)
    pendingOpRef.current = null
  }

  async function handleSwitchSplit(splitId: string) {
    await flushPendingOp()
    setActiveSplitId(splitId)
  }

  function handleRemove(exerciseName: string) {
    const rows = exerciseMap.get(activeSplitId) ?? []
    const row = rows.find(r => r.exercise_name === exerciseName)
    if (!row) return
    const splitId = activeSplitId

    // Optimistic: remove from UI immediately
    setExerciseMap(prev => {
      const next = new Map(prev)
      next.set(splitId, (prev.get(splitId) ?? []).filter(r => r.exercise_name !== exerciseName))
      return next
    })

    const flush = async () => {
      try {
        await removeExerciseFromRoutine(supabase, userId, splitId, exerciseName)
      } catch {
        // DB delete failed — restore row in UI
        setExerciseMap(prev => {
          const next = new Map(prev)
          const current = prev.get(splitId) ?? []
          next.set(splitId, [...current, row].sort((a, b) => a.sort_order - b.sort_order))
          return next
        })
      }
    }

    const undo = () => {
      setExerciseMap(prev => {
        const next = new Map(prev)
        const current = prev.get(splitId) ?? []
        next.set(splitId, [...current, row].sort((a, b) => a.sort_order - b.sort_order))
        return next
      })
    }

    const timeoutId = setTimeout(() => {
      flush()
      setPendingOp(null)
      pendingOpRef.current = null
    }, 3000)

    startPendingOp({ splitId, message: t('exerciseRemoved', { name: exerciseName }), timeoutId, flush, undo })
  }

  // GYM-83: Reorder via ▲/▼. Optimistic local swap → PATCH /api/routine/[splitId]
  // → replace local state with the server response (authoritative). On error
  // we revert and show a toast. All ▲/▼ controls are disabled during the
  // round-trip so a second tap can't race the first.
  async function handleReorder(rowId: string, direction: 'up' | 'down') {
    if (reordering) return
    await flushPendingOp()
    const splitId = activeSplitId
    const rows = exerciseMap.get(splitId) ?? []
    const idx = rows.findIndex(r => r.id === rowId)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= rows.length) return

    const optimistic = rows.slice()
    ;[optimistic[idx], optimistic[swapIdx]] = [optimistic[swapIdx], optimistic[idx]]
    const orderedIds = optimistic.map(r => r.id)
    const snapshot = rows

    setExerciseMap(prev => {
      const next = new Map(prev)
      next.set(splitId, optimistic)
      return next
    })
    setReordering(true)
    setReorderError(null)

    try {
      const res = await fetch(`/api/routine/${splitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', orderedIds }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      const { exercises } = await res.json() as { exercises: RoutineExerciseRow[] }
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(splitId, exercises)
        return next
      })
    } catch (err) {
      console.error('handleReorder failed:', err)
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(splitId, snapshot)
        return next
      })
      setReorderError(t('reorderFailed'))
      setTimeout(() => setReorderError(null), 3000)
    } finally {
      setReordering(false)
    }
  }

  function handleAddExercise(def: ExerciseDefinition) {
    setShowPicker(false)
    const splitId = activeSplitId
    const rows = exerciseMap.get(splitId) ?? []
    const sortOrder = rows.length ? Math.max(...rows.map(r => r.sort_order)) + 1 : 0
    const tempId = `temp-${Date.now()}`
    const tempRow: RoutineExerciseRow = {
      id: tempId,
      exercise_name: def.name,
      canonical_name: def.name,
      sets: 3,
      rep_range_min: 8,
      rep_range_max: 12,
      backup_name: null,
      weight_unit: 'lbs',
      weight_convention: null,
      sort_order: sortOrder,
      equipment: def.equipment ?? null,
    }

    // Optimistic: append to UI immediately
    setExerciseMap(prev => {
      const next = new Map(prev)
      next.set(splitId, [...(prev.get(splitId) ?? []), tempRow])
      return next
    })

    const flush = async () => {
      try {
        const realRow = await addExerciseToRoutine(supabase, userId, splitId, {
          name: def.name,
          equipment: def.equipment ?? undefined,
        }, sortOrder, 'manual-add')
        setExerciseMap(prev => {
          const next = new Map(prev)
          next.set(splitId, (prev.get(splitId) ?? []).map(r => r.id === tempId ? realRow : r))
          return next
        })
      } catch (err) {
        console.error('handleAddExercise flush failed:', err)
        // INSERT failed — remove the optimistic row
        setExerciseMap(prev => {
          const next = new Map(prev)
          next.set(splitId, (prev.get(splitId) ?? []).filter(r => r.id !== tempId))
          return next
        })
      }
    }

    const undo = () => {
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(splitId, (prev.get(splitId) ?? []).filter(r => r.id !== tempId))
        return next
      })
    }

    const splitName = splits.find(s => s.id === splitId)?.name ?? ''
    const timeoutId = setTimeout(() => {
      flush()
      setPendingOp(null)
      pendingOpRef.current = null
    }, 3000)

    startPendingOp({ splitId, message: t('exerciseAdded', { name: def.name, split: splitName }), timeoutId, flush, undo })
  }

  function handleSwapExercise(target: RoutineExerciseRow, newDef: ExerciseDefinition) {
    setSwapTarget(null)
    const splitId = activeSplitId
    const originalRow = target
    const tempId = `temp-${Date.now()}`
    const tempRow: RoutineExerciseRow = {
      ...target,
      id: tempId,
      exercise_name: newDef.name,
      canonical_name: newDef.name,
      equipment: newDef.equipment ?? null,
    }

    // Optimistic: replace in UI immediately
    setExerciseMap(prev => {
      const next = new Map(prev)
      next.set(splitId, (prev.get(splitId) ?? []).map(r => r.id === target.id ? tempRow : r))
      return next
    })

    const flush = async () => {
      try {
        const realRow = await swapExerciseInRoutine(supabase, userId, splitId, target.exercise_name, {
          name: newDef.name,
          equipment: newDef.equipment ?? undefined,
        })
        setExerciseMap(prev => {
          const next = new Map(prev)
          next.set(splitId, (prev.get(splitId) ?? []).map(r => r.id === tempId ? realRow : r))
          return next
        })
      } catch (err) {
        console.error('handleSwapExercise flush failed:', err)
        // Swap failed — restore original
        setExerciseMap(prev => {
          const next = new Map(prev)
          next.set(splitId, (prev.get(splitId) ?? []).map(r => r.id === tempId ? originalRow : r))
          return next
        })
      }
    }

    const undo = () => {
      setExerciseMap(prev => {
        const next = new Map(prev)
        next.set(splitId, (prev.get(splitId) ?? []).map(r => r.id === tempId ? originalRow : r))
        return next
      })
    }

    const timeoutId = setTimeout(() => {
      flush()
      setPendingOp(null)
      pendingOpRef.current = null
    }, 3000)

    startPendingOp({
      splitId,
      message: t('exerciseSwapped', { from: target.exercise_name, to: newDef.name }),
      timeoutId,
      flush,
      undo,
    })
  }

  const currentRows = exerciseMap.get(activeSplitId) ?? []
  const pickerExcludeNames = swapTarget
    ? currentRows.filter(r => r.exercise_name !== swapTarget.exercise_name).map(r => r.exercise_name)
    : currentRows.map(r => r.exercise_name)
  const swapTargetDef = swapTarget ? findExerciseByName(swapTarget.exercise_name) : undefined

  const pickerOpen = showPicker || swapTarget !== null

  if (loading) {
    return (
      <div className="screen-enter flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
        <Header onBack={handleBack} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            {t('loading')}
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="screen-enter flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
        <Header onBack={handleBack} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px' }}>
          <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--rust)', letterSpacing: '0.08em' }}>
            {error}
          </span>
          <button
            onClick={() => { setError(null); setLoading(true); window.location.reload() }}
            style={{ background: 'none', border: '1px solid var(--border-2)', color: 'var(--text-mid)', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', padding: '8px 16px', minHeight: '44px', borderRadius: '2px', cursor: 'pointer', letterSpacing: '0.08em' }}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
      <Header onBack={handleBack} />

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
              minHeight: '44px',
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
              {t('noExercises')}
            </div>
            <div className="font-body" style={{ fontSize: '0.85rem', color: 'var(--border-2)' }}>
              {t('tapAddExerciseHint')}
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
                onClick={async () => { await flushPendingOp(); setSwapTarget(row) }}
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
                  {row.sets}×{row.rep_range_min}–{row.rep_range_max} · {t('tapToSwap')}
                </span>
              </button>

              {/* Reorder ▲/▼ — GYM-83 */}
              <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, marginRight: '2px' }}>
                <button
                  onClick={e => { e.stopPropagation(); handleReorder(row.id, 'up') }}
                  disabled={i === 0 || reordering}
                  aria-label={t('moveUp')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: i === 0 ? 'var(--border-2)' : 'var(--text-secondary)',
                    cursor: i === 0 || reordering ? 'default' : 'pointer',
                    padding: '4px 8px',
                    minHeight: '22px',
                    minWidth: '44px',
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '0.7rem',
                    lineHeight: 1,
                    opacity: reordering && i !== 0 ? 0.4 : 1,
                  }}
                >
                  ▲
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleReorder(row.id, 'down') }}
                  disabled={i === currentRows.length - 1 || reordering}
                  aria-label={t('moveDown')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: i === currentRows.length - 1 ? 'var(--border-2)' : 'var(--text-secondary)',
                    cursor: i === currentRows.length - 1 || reordering ? 'default' : 'pointer',
                    padding: '4px 8px',
                    minHeight: '22px',
                    minWidth: '44px',
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '0.7rem',
                    lineHeight: 1,
                    opacity: reordering && i !== currentRows.length - 1 ? 0.4 : 1,
                  }}
                >
                  ▼
                </button>
              </div>

              {/* Remove */}
              <button
                onClick={e => { e.stopPropagation(); handleRemove(row.exercise_name) }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '14px 20px 14px 8px',
                  minHeight: '44px',
                  minWidth: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
          {t('addExercise')}
        </button>
      </div>

      {/* Undo toast — covers add, swap, delete (GYM-94) */}
      {pendingOp && (
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
            {pendingOp.message}
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
              padding: '12px',
              minHeight: '44px',
              minWidth: '44px',
              fontWeight: 700,
            }}
          >
            {t('undo')}
          </button>
        </div>
      )}

      {/* Reorder error toast — GYM-83 */}
      {reorderError && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
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
            {reorderError}
          </span>
        </div>
      )}

      {pickerOpen && activeSplit && (
        <ExercisePickerSheet
          split={activeSplit.name}
          splitMuscles={splitMuscles?.[activeSplit.name] ?? []}
          excludeNames={pickerExcludeNames}
          swapTarget={swapTargetDef}
          userId={userId}
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
  const t = useTranslations('screens.routineEditor')
  return (
    <div
      className="safe-top flex items-center gap-4 px-5"
      style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
    >
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', padding: '4px', minWidth: '44px', minHeight: '44px' }}
      >
        ←
      </button>
      <span className="font-display" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
        {t('title')}
      </span>
    </div>
  )
}
