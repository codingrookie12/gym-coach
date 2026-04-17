'use client'

import { useState } from 'react'
import { Split } from '@/lib/routines'
import { ExercisePlan } from '@/lib/coaching'
import { ExerciseLog } from '@/lib/store'
import NumberPad from '@/components/NumberPad'

interface PreSaveSummaryScreenProps {
  split: Split
  plan: ExercisePlan[]
  logs: ExerciseLog[]
  onSave: (logs: ExerciseLog[]) => Promise<void>
  onBack: () => void
}

type EditTarget = { exIdx: number; setIdx: number; field: 'weight' | 'reps' } | null

export default function PreSaveSummaryScreen({
  split, plan, logs: initialLogs, onSave, onBack,
}: PreSaveSummaryScreenProps) {
  const [logs, setLogs] = useState<ExerciseLog[]>(initialLogs)
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [saving, setSaving] = useState(false)

  function openEdit(exIdx: number, setIdx: number, field: 'weight' | 'reps') {
    setEditTarget({ exIdx, setIdx, field })
  }

  function confirmEdit(value: number) {
    if (!editTarget) return
    const { exIdx, setIdx, field } = editTarget
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[exIdx], sets: [...next[exIdx].sets] }
      ex.sets[setIdx] = { ...ex.sets[setIdx], [field]: value }
      next[exIdx] = ex
      return next
    })
    setEditTarget(null)
  }

  async function handleSave() {
    setSaving(true)
    await onSave(logs)
    setSaving(false)
  }

  const totalCompleted = logs.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0)
  const totalSkipped = logs.reduce((acc, ex) => acc + ex.sets.filter(s => s.skipped).length, 0)

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100dvh' }}>

      {/* Header */}
      <div className="safe-top flex items-center gap-4 px-5" style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', padding: '4px' }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <p className="section-label" style={{ margin: '0 0 2px 0' }}>REVIEW SESSION</p>
          <h1 className="font-display" style={{ fontSize: '1.7rem', margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1 }}>
            {split} Day
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span className="tag accent">{totalCompleted} sets</span>
          {totalSkipped > 0 && (
            <span className="tag rust">{totalSkipped} skipped</span>
          )}
        </div>
      </div>

      <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: '10px 20px 0', flexShrink: 0, letterSpacing: '0.06em' }}>
        TAP ANY VALUE TO EDIT BEFORE SAVING
      </p>

      {/* Exercise list */}
      <div className="scroll-area flex-1 px-5 py-3" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {logs.map((ex, exIdx) => {
            const hasData = ex.sets.some(s => s.completed || s.skipped)
            if (!hasData) return null
            return (
              <div key={exIdx} className="card p-4">
                <p className="font-sans" style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 10px 0', letterSpacing: '0.02em' }}>
                  {ex.exerciseName}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {ex.sets.map((set, si) => {
                    if (!set.completed && !set.skipped) return null
                    if (set.skipped) {
                      return (
                        <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.4 }}>
                          <span className="section-label" style={{ minWidth: '40px' }}>SET {si + 1}</span>
                          <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--rust)' }}>SKIPPED</span>
                        </div>
                      )
                    }
                    return (
                      <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="section-label" style={{ minWidth: '40px' }}>SET {si + 1}</span>
                        {/* Weight */}
                        <button
                          onClick={() => openEdit(exIdx, si, 'weight')}
                          style={{
                            background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: '2px',
                            padding: '5px 11px', cursor: 'pointer', fontFamily: 'Space Mono, monospace',
                            fontSize: '0.8rem', color: 'var(--text-primary)', transition: 'border-color 0.1s',
                          }}
                        >
                          {set.weight}
                          <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', marginLeft: '3px' }}>
                            {plan[exIdx]?.exercise.weightUnit === 'pins' ? 'pin' : 'lbs'}
                          </span>
                        </button>
                        <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>×</span>
                        {/* Reps */}
                        <button
                          onClick={() => openEdit(exIdx, si, 'reps')}
                          style={{
                            background: 'var(--surface-2)', border: '1px solid var(--accent-border)', borderRadius: '2px',
                            padding: '5px 11px', cursor: 'pointer', fontFamily: 'Space Mono, monospace',
                            fontSize: '0.8rem', color: 'var(--accent)', transition: 'border-color 0.1s',
                          }}
                        >
                          {set.reps}
                          <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', marginLeft: '3px' }}>reps</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Save CTA */}
      <div className="safe-bottom px-5" style={{ paddingTop: '14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
          style={{ opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'SAVING...' : 'SAVE SESSION →'}
        </button>
      </div>

      {/* Edit pad */}
      {editTarget && (
        <NumberPad
          initialValue={
            editTarget.field === 'weight'
              ? logs[editTarget.exIdx].sets[editTarget.setIdx].weight || null
              : logs[editTarget.exIdx].sets[editTarget.setIdx].reps || null
          }
          onConfirm={confirmEdit}
          onCancel={() => setEditTarget(null)}
          label={`Set ${editTarget.setIdx + 1} — ${editTarget.field}`}
          maxValue={editTarget.field === 'weight' ? 999 : 99}
          allowDecimal={editTarget.field === 'weight'}
        />
      )}
    </div>
  )
}
