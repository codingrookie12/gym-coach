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
      <div className="safe-top flex items-center gap-4 px-5" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem', padding: '4px' }}>←</button>
        <div>
          <p className="font-mono-display" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.12em', margin: 0 }}>REVIEW SESSION</p>
          <h1 className="font-mono-display" style={{ fontSize: '1.25rem', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>
            {split} Day
          </h1>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <span className="font-mono-display" style={{ fontSize: '0.7rem', color: 'var(--accent)', background: 'rgba(200,241,53,0.08)', border: '1px solid rgba(200,241,53,0.2)', borderRadius: '3px', padding: '4px 8px' }}>
            {totalCompleted} sets
          </span>
          {totalSkipped > 0 && (
            <span className="font-mono-display" style={{ fontSize: '0.7rem', color: '#ffa500', background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.2)', borderRadius: '3px', padding: '4px 8px' }}>
              {totalSkipped} skipped
            </span>
          )}
        </div>
      </div>

      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '10px 20px 0', flexShrink: 0 }}>
        Tap any value to edit before saving.
      </p>

      {/* Exercise list */}
      <div className="scroll-area flex-1 px-5 py-3" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {logs.map((ex, exIdx) => {
          const hasData = ex.sets.some(s => s.completed || s.skipped)
          if (!hasData) return null
          return (
            <div key={exIdx} className="card p-4">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, margin: '0 0 10px 0' }}>
                {ex.exerciseName}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ex.sets.map((set, si) => {
                  if (!set.completed && !set.skipped) return null
                  if (set.skipped) {
                    return (
                      <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5 }}>
                        <span className="font-mono-display" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', minWidth: '40px' }}>SET {si + 1}</span>
                        <span style={{ fontSize: '0.75rem', color: '#ffa500', fontFamily: 'DM Mono, monospace' }}>SKIPPED</span>
                      </div>
                    )
                  }
                  return (
                    <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="font-mono-display" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', minWidth: '40px' }}>SET {si + 1}</span>
                      {/* Weight */}
                      <button
                        onClick={() => openEdit(exIdx, si, 'weight')}
                        style={{
                          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px',
                          padding: '5px 10px', cursor: 'pointer', fontFamily: 'DM Mono, monospace',
                          fontSize: '0.85rem', color: 'var(--text-primary)',
                        }}
                      >
                        {set.weight}
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginLeft: '3px' }}>
                          {plan[exIdx]?.exercise.weightUnit === 'pins' ? 'pin' : 'lbs'}
                        </span>
                      </button>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>×</span>
                      {/* Reps */}
                      <button
                        onClick={() => openEdit(exIdx, si, 'reps')}
                        style={{
                          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px',
                          padding: '5px 10px', cursor: 'pointer', fontFamily: 'DM Mono, monospace',
                          fontSize: '0.85rem', color: 'var(--accent)',
                        }}
                      >
                        {set.reps}
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginLeft: '3px' }}>reps</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Save CTA */}
      <div className="safe-bottom px-5" style={{ paddingTop: '16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', background: 'var(--accent)', color: '#0A0A0A',
            border: 'none', borderRadius: '4px', padding: '16px',
            fontFamily: 'DM Mono, monospace', fontSize: '0.9rem', fontWeight: 600,
            letterSpacing: '0.08em', cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
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
