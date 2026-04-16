'use client'

import { useState, useCallback } from 'react'
import { Split } from '@/lib/routines'
import { ExercisePlan } from '@/lib/coaching'
import { ExerciseLog, SetLog } from '@/lib/store'
import NumberPad from '@/components/NumberPad'

interface ActiveSessionScreenProps {
  split: Split
  plan: ExercisePlan[]
  onFinish: (logs: ExerciseLog[]) => void
  onBack: () => void
}

type PadMode = 'reps' | 'weight' | null

export default function ActiveSessionScreen({ split, plan, onFinish, onBack }: ActiveSessionScreenProps) {
  // Initialize logs from plan
  const [logs, setLogs] = useState<ExerciseLog[]>(() =>
    plan.map(item => ({
      exerciseName: item.exercise.name,
      backupName: item.exercise.backup,
      sets: Array.from({ length: item.exercise.sets }, (_, i) => ({
        weight: item.targetWeight ?? 0,
        reps: 0,
        completed: false,
      })),
    }))
  )

  const [currentExIdx, setCurrentExIdx] = useState(0)
  const [activeSetIdx, setActiveSetIdx] = useState<number | null>(null)
  const [padMode, setPadMode] = useState<PadMode>(null)
  const [flashSet, setFlashSet] = useState<number | null>(null)
  const [swapShown, setSwapShown] = useState(false)
  const [saving, setSaving] = useState(false)

  const currentEx = logs[currentExIdx]
  const currentPlan = plan[currentExIdx]

  function openRepPad(setIdx: number) {
    setActiveSetIdx(setIdx)
    setPadMode('reps')
  }

  function openWeightPad(setIdx: number) {
    setActiveSetIdx(setIdx)
    setPadMode('weight')
  }

  function confirmReps(value: number) {
    if (activeSetIdx === null) return
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx] }
      const sets = [...ex.sets]
      sets[activeSetIdx] = { ...sets[activeSetIdx], reps: value, completed: true }
      ex.sets = sets
      next[currentExIdx] = ex
      return next
    })
    setFlashSet(activeSetIdx)
    setTimeout(() => setFlashSet(null), 500)
    setPadMode(null)
    setActiveSetIdx(null)

    // Auto-advance: check if all sets done
    const allDone = currentEx.sets.every((s, i) =>
      i === activeSetIdx ? true : s.completed
    )
    if (allDone && currentExIdx < plan.length - 1) {
      setTimeout(() => {
        setCurrentExIdx(idx => idx + 1)
        setSwapShown(false)
      }, 600)
    }
  }

  function confirmWeight(value: number) {
    if (activeSetIdx === null) return
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx] }
      const sets = [...ex.sets]
      // Apply to this set and pre-fill subsequent sets
      for (let i = activeSetIdx; i < sets.length; i++) {
        if (!sets[i].completed) {
          sets[i] = { ...sets[i], weight: value }
        }
      }
      ex.sets = sets
      next[currentExIdx] = ex
      return next
    })
    setPadMode(null)
    setActiveSetIdx(null)
  }

  async function handleFinish() {
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const entries: any[] = []

    for (const exLog of logs) {
      for (const set of exLog.sets) {
        if (!set.completed) continue
        entries.push({
          exercise: exLog.exerciseName,
          date: today,
          split,
          weight: set.weight,
          set: exLog.sets.indexOf(set) + 1,
          reps: set.reps,
          entry: `${exLog.exerciseName} — Set ${exLog.sets.indexOf(set) + 1}`,
        })
      }
    }

    try {
      await fetch('/api/session/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })
    } catch (e) {
      console.error('Write failed:', e)
    }

    setSaving(false)
    onFinish(logs)
  }

  const allCurrentSetsDone = currentEx.sets.every(s => s.completed)
  const isLastExercise = currentExIdx === plan.length - 1
  const progress = (currentExIdx) / plan.length

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100dvh' }}>
      {/* Progress bar */}
      <div className="progress-bar" style={{ flexShrink: 0 }}>
        <div className="progress-bar-fill" style={{ width: `${(currentExIdx / plan.length) * 100}%` }} />
      </div>

      {/* Header */}
      <div
        className="safe-top flex items-center justify-between px-5"
        style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem', padding: '4px' }}
        >
          ←
        </button>
        <span className="font-mono-display" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
          {currentExIdx + 1} / {plan.length}
        </span>
        {allCurrentSetsDone && isLastExercise && (
          <button
            onClick={handleFinish}
            disabled={saving}
            style={{
              background: 'var(--accent)',
              color: '#0A0A0A',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 14px',
              fontFamily: 'DM Mono, monospace',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'SAVING...' : 'FINISH'}
          </button>
        )}
        {!(allCurrentSetsDone && isLastExercise) && (
          <div style={{ width: '60px' }} />
        )}
      </div>

      {/* Exercise name + target */}
      <div className="px-5 py-4" style={{ flexShrink: 0 }}>
        <h2
          style={{
            fontSize: '1.4rem',
            fontFamily: 'DM Mono, monospace',
            fontWeight: 500,
            color: 'var(--text-primary)',
            margin: '0 0 4px 0',
            lineHeight: 1.2,
          }}
        >
          {currentEx.exerciseName}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>
            {currentPlan.exercise.sets}×
            {currentPlan.exercise.repRange[0] === currentPlan.exercise.repRange[1]
              ? currentPlan.exercise.repRange[0]
              : `${currentPlan.exercise.repRange[0]}–${currentPlan.exercise.repRange[1]}`} reps
          </span>
          <button
            className="swap-badge"
            onClick={() => setSwapShown(s => !s)}
          >
            {swapShown ? 'HIDE' : 'SWAP'}
          </button>
        </div>
        {swapShown && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '6px 0 0 0', fontFamily: 'DM Mono, monospace' }}>
            Backup: {currentEx.backupName}
          </p>
        )}
      </div>

      <div className="divider" />

      {/* Sets */}
      <div className="scroll-area flex-1 px-5 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {currentEx.sets.map((set, i) => (
          <div
            key={i}
            className={`card p-4 ${flashSet === i ? 'set-complete-flash' : ''}`}
            style={{
              borderColor: set.completed ? 'rgba(200,241,53,0.3)' : 'var(--border)',
              transition: 'border-color 0.2s',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono-display" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
                SET {i + 1}
              </span>
              {set.completed ? (
                <span style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>✓</span>
              ) : null}
            </div>

            <div className="flex items-center justify-between mt-3">
              {/* Weight */}
              <button
                onClick={() => openWeightPad(i)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '2px',
                  padding: 0,
                }}
              >
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em' }}>WEIGHT</span>
                <span className="font-mono-display" style={{ fontSize: '2rem', fontWeight: 500, color: set.weight > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {set.weight > 0 ? set.weight : '—'}
                  {set.weight > 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>lbs</span>}
                </span>
              </button>

              {/* Log reps button */}
              <button
                onClick={() => openRepPad(i)}
                style={{
                  background: set.completed ? 'rgba(200,241,53,0.08)' : 'var(--surface)',
                  border: `1px solid ${set.completed ? 'rgba(200,241,53,0.3)' : 'var(--border)'}`,
                  borderRadius: '4px',
                  padding: '12px 18px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  minWidth: '80px',
                }}
              >
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em' }}>REPS</span>
                <span className="font-mono-display" style={{ fontSize: '2rem', fontWeight: 500, color: set.reps > 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {set.reps > 0 ? set.reps : '—'}
                </span>
              </button>
            </div>
          </div>
        ))}

        {/* Next exercise preview */}
        {allCurrentSetsDone && !isLastExercise && (
          <div
            style={{
              marginTop: '8px',
              padding: '16px',
              background: 'rgba(200,241,53,0.04)',
              border: '1px solid rgba(200,241,53,0.15)',
              borderRadius: '4px',
            }}
          >
            <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', margin: '0 0 4px 0' }}>
              NEXT UP
            </p>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0 }}>
              {plan[currentExIdx + 1].exercise.name}
            </p>
            <button
              onClick={() => { setCurrentExIdx(i => i + 1); setSwapShown(false) }}
              style={{
                marginTop: '12px',
                width: '100%',
                background: 'var(--accent)',
                color: '#0A0A0A',
                border: 'none',
                borderRadius: '4px',
                padding: '12px',
                fontFamily: 'DM Mono, monospace',
                fontSize: '0.8rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                cursor: 'pointer',
              }}
            >
              NEXT EXERCISE →
            </button>
          </div>
        )}
      </div>

      {/* Number pad overlay */}
      {padMode === 'reps' && activeSetIdx !== null && (
        <NumberPad
          initialValue={currentEx.sets[activeSetIdx].reps || null}
          onConfirm={confirmReps}
          onCancel={() => { setPadMode(null); setActiveSetIdx(null) }}
          label={`Set ${activeSetIdx + 1} — reps`}
          maxValue={99}
        />
      )}
      {padMode === 'weight' && activeSetIdx !== null && (
        <NumberPad
          initialValue={currentEx.sets[activeSetIdx].weight || null}
          onConfirm={confirmWeight}
          onCancel={() => { setPadMode(null); setActiveSetIdx(null) }}
          label={`Set ${activeSetIdx + 1} — weight (lbs)`}
          maxValue={999}
          allowDecimal={true}
        />
      )}
    </div>
  )
}
