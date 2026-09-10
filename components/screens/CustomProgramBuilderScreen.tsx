'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import {
  getUserRoutineForSplit,
  addExerciseToRoutine,
  removeExerciseFromRoutine,
  type RoutineExerciseRow,
} from '@/lib/userRoutine'
import {
  createPendingOpController,
  restoreExerciseSorted,
  replaceExercise,
  dropExercise,
  type PendingOp,
} from '@/lib/pendingSplitOp'
import ExercisePickerSheet from '@/components/ExercisePickerSheet'
import Toast from '@/components/ui/Toast'
import { type ExerciseDefinition } from '@/lib/exerciseLibrary'

interface CustomProgramBuilderScreenProps {
  mode: 'create' | 'edit'
  programId?: string
  userId: string
  activeSession?: boolean
  onCancel: () => void
  onSaved: (programId: string) => void
}

interface SplitState {
  id: string
  name: string
  exercises: RoutineExerciseRow[]
  expanded: boolean
}

export default function CustomProgramBuilderScreen({
  mode, programId, userId, activeSession, onCancel, onSaved,
}: CustomProgramBuilderScreenProps) {
  const t = useTranslations('screens.customProgramBuilder')
  const [programName, setProgramName] = useState('')
  const [splits, setSplits] = useState<SplitState[]>([])
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerSplitIdx, setPickerSplitIdx] = useState<number | null>(null)
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null)
  // GYM-94: edit-mode add/remove exercise writes are deferred behind a 3s
  // Undo toast — see lib/pendingSplitOp.ts for why this is a controller
  // instead of RoutineEditorScreen's inline pattern. Only one op is pending
  // at a time (one toast), scoped by splitId since this screen — unlike
  // RoutineEditorScreen — has every split's controls visible at once.
  const [pendingOp, setPendingOp] = useState<PendingOp | null>(null)
  const pendingOpController = useRef(createPendingOpController(setPendingOp)).current

  const supabase = useRef(createSupabaseBrowserClient()).current
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const splitNameDebounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    if (mode !== 'edit' || !programId) return
    async function load() {
      try {
        const res = await fetch(`/api/user/programs/${programId}`)
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        const p = data.program
        setProgramName(p.name)
        const splitStates: SplitState[] = p.splits
          .filter((s: any) => !s.archivedAt)
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            exercises: s.exercises.map((e: any) => ({
              id: e.id,
              exercise_name: e.exerciseName,
              canonical_name: e.canonicalName,
              sets: e.sets,
              rep_range_min: e.repRangeMin,
              rep_range_max: e.repRangeMax,
              backup_name: e.backupName,
              weight_unit: e.weightUnit ?? 'lbs',
              weight_convention: e.weightConvention ?? null,
              sort_order: e.sortOrder,
              equipment: e.equipment ?? null,
            })) as RoutineExerciseRow[],
            expanded: false,
          }))
        setSplits(splitStates)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('loadFailed'))
        setLoading(false)
      }
    }
    load()
  }, [mode, programId])

  const canSave = programName.trim().length >= 3
    && splits.length >= 1
    && splits.every(s => s.name.trim().length > 0 && s.exercises.length > 0)

  function handleProgramNameChange(value: string) {
    setProgramName(value)
    if (mode === 'edit' && programId && value.trim().length >= 3) {
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current)
      nameDebounceRef.current = setTimeout(() => {
        fetch(`/api/user/programs/${programId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'rename', name: value.trim() }),
        }).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
        }).catch(err => {
          console.error('handleProgramNameChange failed:', err)
          setError(t('renameFailed'))
          setTimeout(() => setError(null), 3000)
        })
      }, 1000)
    }
  }

  function handleSplitNameChange(idx: number, value: string) {
    const split = splits[idx]
    setSplits(prev => prev.map((s, i) => i === idx ? { ...s, name: value } : s))
    if (mode === 'edit' && split.id && value.trim().length > 0) {
      const existing = splitNameDebounceRef.current.get(split.id)
      if (existing) clearTimeout(existing)
      splitNameDebounceRef.current.set(split.id, setTimeout(() => {
        fetch(`/api/user/programs/${programId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'rename-split', splitId: split.id, name: value.trim() }),
        }).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
        }).catch(err => {
          console.error('handleSplitNameChange failed:', err)
          setError(t('renameFailed'))
          setTimeout(() => setError(null), 3000)
        })
      }, 1000))
    }
  }

  async function handleAddSplit() {
    if (splits.length >= 7) return
    const name = `Split ${splits.length + 1}`
    if (mode === 'edit' && programId) {
      try {
        const res = await fetch(`/api/user/programs/${programId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add-split', name }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (data.splitId) {
          setSplits(prev => [...prev, { id: data.splitId, name, exercises: [], expanded: true }])
        }
      } catch (err) {
        console.error('handleAddSplit failed:', err)
        setError(t('addSplitFailed'))
        setTimeout(() => setError(null), 3000)
      }
    } else {
      setSplits(prev => [...prev, { id: `temp-${Date.now()}`, name, exercises: [], expanded: true }])
    }
  }

  async function handleRemoveSplit(idx: number) {
    const split = splits[idx]
    // A pending add/remove scoped to THIS split is dropped outright, not
    // committed — flushing would write an exercise into a split that's
    // about to be archived/removed. A pending op on any OTHER split still
    // commits normally so its write isn't silently lost by an unrelated
    // action elsewhere on the screen.
    if (pendingOpController.current?.splitId === split.id) {
      pendingOpController.discard()
    } else {
      await pendingOpController.flush()
    }
    if (mode === 'edit' && programId && !split.id.startsWith('temp-')) {
      try {
        const res = await fetch(`/api/user/programs/${programId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'remove-split', splitId: split.id }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (data.archived) {
          setError(t('archiveNotice'))
          setTimeout(() => setError(null), 3000)
        }
      } catch (err) {
        // Server-side state is unknown/unchanged — don't drop the split from
        // local state, or a still-live (or even successfully-archived) split
        // with real workout history behind it would silently vanish from the
        // UI while remaining fully intact server-side.
        console.error('handleRemoveSplit failed:', err)
        setError(t('removeSplitFailed'))
        setTimeout(() => setError(null), 3000)
        setConfirmDeleteIdx(null)
        return
      }
    }
    setSplits(prev => prev.filter((_, i) => i !== idx))
    setConfirmDeleteIdx(null)
  }

  async function handleReorder(idx: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= splits.length) return
    const snapshot = splits
    const newSplits = [...splits]
    const temp = newSplits[idx]
    newSplits[idx] = newSplits[targetIdx]
    newSplits[targetIdx] = temp
    setSplits(newSplits)
    if (mode === 'edit' && programId) {
      const splitIds = newSplits.filter(s => !s.id.startsWith('temp-')).map(s => s.id)
      try {
        const res = await fetch(`/api/user/programs/${programId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reorder-splits', splitIds }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } catch (err) {
        console.error('handleReorder failed:', err)
        setSplits(snapshot)
        setError(t('reorderFailed'))
        setTimeout(() => setError(null), 3000)
      }
    }
  }

  const handleAddExercise = useCallback((def: ExerciseDefinition) => {
    if (pickerSplitIdx === null) return
    const idx = pickerSplitIdx
    const split = splits[idx]
    setPickerSplitIdx(null)

    const sortOrder = split.exercises.length
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

    // Optimistic: append to UI immediately.
    setSplits(prev => prev.map((s, i) =>
      i === idx ? { ...s, exercises: [...s.exercises, tempRow] } : s
    ))

    // Splits not yet persisted (create mode, or a split added this session
    // that hasn't round-tripped to the server) have nothing to write here —
    // the whole program is serialized in one POST at Save time, so "picker
    // tap alone never persists" (GYM-94) already holds without a toast.
    if (mode !== 'edit' || split.id.startsWith('temp-')) return

    const splitId = split.id
    const flush = async () => {
      try {
        const realRow = await addExerciseToRoutine(supabase, userId, splitId, {
          name: def.name,
          equipment: def.equipment ?? undefined,
        }, sortOrder, 'manual-add')
        setSplits(prev => prev.map(s =>
          s.id === splitId ? { ...s, exercises: replaceExercise(s.exercises, tempId, realRow) } : s
        ))
      } catch (err) {
        console.error('handleAddExercise flush failed:', err)
        setSplits(prev => prev.map(s =>
          s.id === splitId ? { ...s, exercises: dropExercise(s.exercises, tempId) } : s
        ))
      }
    }
    const undo = () => {
      setSplits(prev => prev.map(s =>
        s.id === splitId ? { ...s, exercises: dropExercise(s.exercises, tempId) } : s
      ))
    }

    pendingOpController.start({
      splitId,
      message: t('exerciseAdded', { name: def.name, split: split.name }),
      flush,
      undo,
    })
  }, [pickerSplitIdx, splits, mode, supabase, userId, pendingOpController, t])

  function handleRemoveExercise(splitIdx: number, exerciseName: string) {
    const split = splits[splitIdx]
    const row = split.exercises.find(e => e.exercise_name === exerciseName)
    if (!row) return

    // Optimistic: remove from UI immediately.
    setSplits(prev => prev.map((s, i) =>
      i === splitIdx ? { ...s, exercises: s.exercises.filter(e => e.exercise_name !== exerciseName) } : s
    ))

    if (mode !== 'edit' || split.id.startsWith('temp-')) return

    const splitId = split.id
    const flush = async () => {
      try {
        await removeExerciseFromRoutine(supabase, userId, splitId, exerciseName)
      } catch (err) {
        console.error('handleRemoveExercise flush failed:', err)
        setSplits(prev => prev.map(s =>
          s.id === splitId ? { ...s, exercises: restoreExerciseSorted(s.exercises, row) } : s
        ))
      }
    }
    const undo = () => {
      setSplits(prev => prev.map(s =>
        s.id === splitId ? { ...s, exercises: restoreExerciseSorted(s.exercises, row) } : s
      ))
    }

    pendingOpController.start({
      splitId,
      message: t('exerciseRemoved', { name: exerciseName }),
      flush,
      undo,
    })
  }

  function handleSetsChange(splitIdx: number, exerciseId: string, value: number) {
    const clamped = Math.max(1, Math.min(10, value))
    setSplits(prev => prev.map((s, i) =>
      i === splitIdx ? { ...s, exercises: s.exercises.map(e => e.id === exerciseId ? { ...e, sets: clamped } : e) } : s
    ))
  }

  function handleRepMinChange(splitIdx: number, exerciseId: string, value: number) {
    const clamped = Math.max(1, Math.min(50, value))
    setSplits(prev => prev.map((s, i) =>
      i === splitIdx ? { ...s, exercises: s.exercises.map(e => e.id === exerciseId ? { ...e, rep_range_min: clamped } : e) } : s
    ))
  }

  function handleRepMaxChange(splitIdx: number, exerciseId: string, value: number) {
    const clamped = Math.max(1, Math.min(50, value))
    setSplits(prev => prev.map((s, i) =>
      i === splitIdx ? { ...s, exercises: s.exercises.map(e => e.id === exerciseId ? { ...e, rep_range_max: clamped } : e) } : s
    ))
  }

  // Edit mode's Save has no API round-trip of its own (below) — it just
  // navigates away, trusting that every routine write already landed. Flush
  // first so a still-pending add/remove commits instead of being lost.
  const handleCancel = useCallback(async () => {
    await pendingOpController.flush()
    onCancel()
  }, [pendingOpController, onCancel])

  async function handleSave() {
    if (!canSave || saving) return
    await pendingOpController.flush()
    setSaving(true)
    try {
      if (mode === 'create') {
        const payload = {
          kind: 'create',
          name: programName.trim(),
          splits: splits.map(s => ({
            name: s.name.trim(),
            exercises: s.exercises.map(e => ({
              name: e.exercise_name,
              sets: e.sets,
              repRange: [e.rep_range_min, e.rep_range_max],
              // Custom exercises aren't in the static catalog the server
              // falls back to (lib/exercises.json) — send the equipment tag
              // straight from picker state so it isn't silently dropped.
              equipment: e.equipment,
            })),
          })),
        }
        const res = await fetch('/api/user/programs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        onSaved(data.programId)
      } else {
        onSaved(programId!)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'))
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="screen-enter flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
        <BuilderHeader onCancel={onCancel} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            {t('loading')}
          </span>
        </div>
      </div>
    )
  }

  const pickerOpen = pickerSplitIdx !== null
  const pickerExcludeNames = pickerSplitIdx !== null
    ? splits[pickerSplitIdx]?.exercises.map(e => e.exercise_name) ?? []
    : []

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
      <BuilderHeader onCancel={handleCancel} />

      {activeSession && (
        <div style={{ padding: '10px 20px', background: 'var(--rust)', flexShrink: 0 }}>
          <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--on-rust)', margin: 0, textAlign: 'center' }}>
            {t('sessionBlockBanner')}
          </p>
        </div>
      )}

      <div className="scroll-area" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>
        {error && (
          <div style={{ padding: '8px 12px', background: 'var(--rust)', borderRadius: '2px', marginBottom: '12px' }}>
            <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--on-rust)', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Program name */}
        <div style={{ marginBottom: '20px' }}>
          <label className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>
            {t('programName')}
          </label>
          <input
            type="text"
            value={programName}
            onChange={e => handleProgramNameChange(e.target.value)}
            disabled={!!activeSession}
            placeholder={t('namePlaceholder')}
            maxLength={60}
            style={{
              width: '100%', padding: '10px 12px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)', fontSize: '0.95rem',
            }}
          />
        </div>

        {/* Splits */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {splits.map((split, idx) => (
            <div key={split.id} style={{ border: '1px solid var(--border)', borderRadius: '2px', background: 'var(--surface)' }}>
              {/* Split header */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', gap: '8px' }}>
                <input
                  type="text"
                  value={split.name}
                  onChange={e => handleSplitNameChange(idx, e.target.value)}
                  disabled={!!activeSession}
                  maxLength={40}
                  placeholder={t('splitNamePlaceholder')}
                  style={{
                    flex: 1, padding: '6px 8px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)', fontSize: '0.85rem',
                  }}
                />
                <button
                  onClick={() => handleReorder(idx, 'up')}
                  disabled={idx === 0 || !!activeSession}
                  style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, color: 'var(--text-mid)', fontSize: '1rem', padding: '4px', minWidth: '32px', minHeight: '32px' }}
                >
                  ▲
                </button>
                <button
                  onClick={() => handleReorder(idx, 'down')}
                  disabled={idx === splits.length - 1 || !!activeSession}
                  style={{ background: 'none', border: 'none', cursor: idx === splits.length - 1 ? 'default' : 'pointer', opacity: idx === splits.length - 1 ? 0.3 : 1, color: 'var(--text-mid)', fontSize: '1rem', padding: '4px', minWidth: '32px', minHeight: '32px' }}
                >
                  ▼
                </button>
                <button
                  onClick={() => setSplits(prev => prev.map((s, i) => i === idx ? { ...s, expanded: !s.expanded } : s))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mid)', fontSize: '0.8rem', padding: '4px', minWidth: '32px', minHeight: '32px', fontFamily: 'Space Mono, monospace' }}
                >
                  {split.expanded ? '−' : '+'}
                </button>
                {confirmDeleteIdx === idx ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => handleRemoveSplit(idx)}
                      disabled={!!activeSession}
                      style={{ background: 'var(--rust)', border: 'none', color: 'var(--on-rust)', fontSize: '0.6rem', padding: '4px 8px', minHeight: '44px', borderRadius: '2px', cursor: 'pointer', fontFamily: 'Space Mono, monospace' }}
                    >
                      {t('delete')}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteIdx(null)}
                      style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-mid)', fontSize: '0.6rem', padding: '4px 8px', minHeight: '44px', borderRadius: '2px', cursor: 'pointer', fontFamily: 'Space Mono, monospace' }}
                    >
                      {t('cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteIdx(idx)}
                    disabled={!!activeSession}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rust)', fontSize: '0.7rem', padding: '4px', minWidth: '32px', minHeight: '32px', fontFamily: 'Space Mono, monospace' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Expanded body: exercises */}
              {split.expanded && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px' }}>
                  {split.exercises.length === 0 && (
                    <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', margin: '8px 0', textAlign: 'center' }}>
                      {t('noExercises')}
                    </p>
                  )}
                  {split.exercises.map(exercise => (
                    <div key={exercise.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', gap: '8px' }}>
                      <span className="font-sans" style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        {exercise.exercise_name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>{t('setsLabel')}</label>
                        <input
                          type="number"
                          value={exercise.sets}
                          onChange={e => handleSetsChange(idx, exercise.id, parseInt(e.target.value) || 1)}
                          disabled={!!activeSession}
                          min={1} max={10}
                          style={{ width: '36px', padding: '3px', textAlign: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <input
                          type="number"
                          value={exercise.rep_range_min}
                          onChange={e => handleRepMinChange(idx, exercise.id, parseInt(e.target.value) || 1)}
                          disabled={!!activeSession}
                          min={1} max={50}
                          style={{ width: '32px', padding: '3px', textAlign: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                        />
                        <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>–</span>
                        <input
                          type="number"
                          value={exercise.rep_range_max}
                          onChange={e => handleRepMaxChange(idx, exercise.id, parseInt(e.target.value) || 1)}
                          disabled={!!activeSession}
                          min={1} max={50}
                          style={{ width: '32px', padding: '3px', textAlign: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveExercise(idx, exercise.exercise_name)}
                        disabled={!!activeSession}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rust)', fontSize: '0.7rem', padding: '4px', minWidth: '32px', minHeight: '32px' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setPickerSplitIdx(idx)}
                    disabled={!!activeSession}
                    className="font-mono"
                    style={{
                      display: 'block', width: '100%', marginTop: '8px', padding: '10px',
                      minHeight: '44px',
                      background: 'none', border: '1px dashed var(--border-2)',
                      color: 'var(--accent)', fontSize: '0.65rem', cursor: 'pointer',
                      letterSpacing: '0.08em', borderRadius: '2px',
                    }}
                  >
                    {t('addExerciseButton')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add split button */}
        <button
          onClick={handleAddSplit}
          disabled={splits.length >= 7 || !!activeSession}
          className="font-mono"
          style={{
            display: 'block', width: '100%', marginTop: '16px', padding: '12px',
            minHeight: '44px',
            background: 'none', border: '1px dashed var(--border-2)',
            color: splits.length >= 7 ? 'var(--text-secondary)' : 'var(--accent)',
            fontSize: '0.7rem', cursor: splits.length >= 7 ? 'default' : 'pointer',
            letterSpacing: '0.08em', borderRadius: '2px',
          }}
        >
          {t('addSplitButton')}
        </button>
      </div>

      {/* Bottom save bar */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          onClick={handleSave}
          disabled={!canSave || saving || !!activeSession}
          className="btn-primary"
          style={{ opacity: canSave && !saving ? 1 : 0.5 }}
        >
          {saving ? t('savingButton') : mode === 'create' ? t('saveButton') : t('saveButtonEdit')}
        </button>
      </div>

      {/* Exercise picker */}
      {pickerOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'var(--bg)' }}>
          <ExercisePickerSheet
            split={pickerSplitIdx !== null ? splits[pickerSplitIdx]?.name ?? '' : ''}
            excludeNames={pickerExcludeNames}
            userId={userId}
            onSelect={handleAddExercise}
            onClose={() => setPickerSplitIdx(null)}
          />
        </div>
      )}

      {/* Undo toast — GYM-94: covers edit-mode add/remove exercise */}
      {pendingOp && (
        <Toast
          message={pendingOp.message}
          onUndo={() => pendingOpController.undo()}
          onTimeout={() => { pendingOpController.flush() }}
        />
      )}
    </div>
  )
}

function BuilderHeader({ onCancel }: { onCancel: () => void }) {
  const t = useTranslations('screens.customProgramBuilder')
  return (
    <div
      className="safe-top flex items-center gap-4 px-5"
      style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
    >
      <button
        onClick={onCancel}
        style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', padding: '4px', minWidth: '44px', minHeight: '44px', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem' }}
      >
        ←
      </button>
      <div style={{ flex: 1 }}>
        <h1 className="font-display" style={{ fontSize: '1.5rem', margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1 }}>
          {t('title')}
        </h1>
      </div>
    </div>
  )
}
