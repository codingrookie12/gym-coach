'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Split } from '@/lib/routines'
import { ExercisePlan } from '@/lib/coaching'
import { ExerciseLog, SetLog } from '@/lib/store'
import NumberPad from '@/components/NumberPad'

interface ActiveSessionScreenProps {
  split: Split
  plan: ExercisePlan[]
  initialLogs?: ExerciseLog[]
  initialExIdx?: number
  onFinish: (logs: ExerciseLog[]) => void
  onBack: (logs: ExerciseLog[], exIdx: number) => void
}

type PadMode = 'reps' | 'weight' | null

// ── Rest Timer ────────────────────────────────────────────────────────────────
function RestTimer({ onDismiss }: { onDismiss: () => void }) {
  const [seconds, setSeconds] = useState(0)
  const [targetSeconds, setTargetSeconds] = useState(120) // default 2 min
  const [editingTarget, setEditingTarget] = useState(false)
  const [inputVal, setInputVal] = useState('120')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds(s => s + 1)
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const elapsed = seconds
  const remaining = Math.max(targetSeconds - elapsed, 0)
  const done = elapsed >= targetSeconds
  const progress = Math.min(elapsed / targetSeconds, 1)

  // Circle math
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = circ * progress
  const gap = circ - dash

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  function commitTarget() {
    const val = parseInt(inputVal)
    if (!isNaN(val) && val > 0) setTargetSeconds(val)
    setEditingTarget(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        background: done ? 'rgba(200,241,53,0.06)' : 'rgba(255,100,100,0.06)',
        border: `1px solid ${done ? 'rgba(200,241,53,0.3)' : 'rgba(255,100,100,0.25)'}`,
        borderRadius: '6px',
        flexShrink: 0,
      }}
    >
      {/* Circle indicator */}
      <svg width="64" height="64" style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke={done ? 'var(--accent)' : '#ff6464'}
          strokeWidth="4"
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s linear' }}
        />
      </svg>

      {/* Time display */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span
            className="font-mono-display"
            style={{ fontSize: '1.6rem', fontWeight: 500, color: done ? 'var(--accent)' : '#ff6464', lineHeight: 1 }}
          >
            {done ? fmt(elapsed) : fmt(remaining)}
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>
            {done ? 'done' : 'left'}
          </span>
        </div>

        {editingTarget ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <input
              type="number"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onBlur={commitTarget}
              onKeyDown={e => e.key === 'Enter' && commitTarget()}
              autoFocus
              style={{
                width: '60px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontFamily: 'DM Mono, monospace',
                fontSize: '0.75rem',
                padding: '3px 6px',
                borderRadius: '3px',
              }}
            />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>sec</span>
          </div>
        ) : (
          <button
            onClick={() => { setInputVal(String(targetSeconds)); setEditingTarget(true) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace',
              padding: 0, marginTop: '3px', display: 'block',
            }}
          >
            target: {fmt(targetSeconds)} · tap to edit
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: '4px',
          color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', fontSize: '0.7rem',
          padding: '6px 10px', cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  )
}

// ── Workout Overview Modal ────────────────────────────────────────────────────
function WorkoutOverviewModal({
  plan,
  logs,
  currentExIdx,
  onClose,
}: {
  plan: ExercisePlan[]
  logs: ExerciseLog[]
  currentExIdx: number
  onClose: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 40,
        background: 'rgba(10,10,10,0.96)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div>
          <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.12em', margin: 0 }}>SESSION OVERVIEW</p>
          <h2 style={{ fontSize: '1.1rem', fontFamily: 'DM Mono, monospace', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
            {plan.length} exercises
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: '4px',
            color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', fontSize: '0.8rem',
            padding: '8px 12px', cursor: 'pointer',
          }}
        >
          CLOSE
        </button>
      </div>
      <div style={{ overflow: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {plan.map((item, i) => {
          const log = logs[i]
          const completedSets = log.sets.filter(s => s.completed).length
          const totalSets = log.sets.length
          const isCurrent = i === currentExIdx
          const isDone = completedSets === totalSets
          return (
            <div
              key={i}
              style={{
                padding: '12px 14px',
                borderRadius: '4px',
                background: isCurrent ? 'rgba(200,241,53,0.04)' : 'var(--surface)',
                border: `1px solid ${isCurrent ? 'rgba(200,241,53,0.25)' : isDone ? 'rgba(200,241,53,0.15)' : 'var(--border)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: isCurrent ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {log.exerciseName}
                    {isCurrent && <span style={{ fontSize: '0.6rem', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', marginLeft: '6px' }}>← NOW</span>}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: isDone ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>
                  {isDone ? '✓ done' : i < currentExIdx ? `${completedSets}/${totalSets}` : i === currentExIdx ? `${completedSets}/${totalSets}` : '—'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Back Nav Guard ────────────────────────────────────────────────────────────
function BackGuardModal({
  onResume,
  onGoBack,
}: {
  onResume: () => void
  onGoBack: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(10,10,10,0.97)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px',
      }}
    >
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.12em', margin: '0 0 12px 0' }}>
        SESSION IN PROGRESS
      </p>
      <h2 style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.2rem', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 8px 0', textAlign: 'center' }}>
        Go back?
      </h2>
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 32px 0', textAlign: 'center', lineHeight: 1.6 }}>
        Your progress is saved. You can resume from where you left off.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '280px' }}>
        <button
          onClick={onResume}
          style={{
            width: '100%', background: 'var(--accent)', color: '#0A0A0A',
            border: 'none', borderRadius: '4px', padding: '16px',
            fontFamily: 'DM Mono, monospace', fontSize: '0.85rem', fontWeight: 600,
            letterSpacing: '0.08em', cursor: 'pointer',
          }}
        >
          KEEP GOING
        </button>
        <button
          onClick={onGoBack}
          style={{
            width: '100%', background: 'none', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', borderRadius: '4px', padding: '14px',
            fontFamily: 'DM Mono, monospace', fontSize: '0.85rem',
            letterSpacing: '0.08em', cursor: 'pointer',
          }}
        >
          GO BACK (progress saved)
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ActiveSessionScreen({
  split,
  plan,
  initialLogs,
  initialExIdx = 0,
  onFinish,
  onBack,
}: ActiveSessionScreenProps) {
  const [logs, setLogs] = useState<ExerciseLog[]>(() =>
    initialLogs ??
    plan.map(item => ({
      exerciseName: item.exercise.name,
      backupName: item.exercise.backup,
      sets: Array.from({ length: item.exercise.sets }, () => ({
        weight: item.targetWeight ?? 0,
        reps: 0,
        completed: false,
      })),
    }))
  )

  const [currentExIdx, setCurrentExIdx] = useState(initialExIdx)
  const [activeSetIdx, setActiveSetIdx] = useState<number | null>(null)
  const [padMode, setPadMode] = useState<PadMode>(null)
  const [flashSet, setFlashSet] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Per-exercise unit override: 'lbs' | 'pins'
  const [unitOverrides, setUnitOverrides] = useState<Record<number, 'lbs' | 'pins'>>({})

  // Timer
  const [timerKey, setTimerKey] = useState(0)
  const [timerVisible, setTimerVisible] = useState(false)

  // Overview modal
  const [overviewVisible, setOverviewVisible] = useState(false)

  // Back guard
  const [backGuardVisible, setBackGuardVisible] = useState(false)

  // Backup swap
  const [swapShown, setSwapShown] = useState(false)

  const currentEx = logs[currentExIdx]
  const currentPlan = plan[currentExIdx]
  const exerciseDef = currentPlan.exercise

  // Determine active unit for current exercise
  const defaultUnit = exerciseDef.weightUnit ?? 'lbs'
  const activeUnit = unitOverrides[currentExIdx] ?? defaultUnit

  function getWeightLabel(weight: number) {
    return activeUnit === 'pins' ? `pin ${weight}` : `${weight}`
  }

  function getWeightSuffix() {
    return activeUnit === 'pins' ? '' : 'lbs'
  }

  function toggleUnit() {
    setUnitOverrides(prev => ({
      ...prev,
      [currentExIdx]: prev[currentExIdx] === 'pins' ? 'lbs'
        : prev[currentExIdx] === 'lbs' ? 'pins'
        : defaultUnit === 'pins' ? 'lbs' : 'pins',
    }))
  }

  // Available weights for step picker (pins or stack)
  const availableWeights = exerciseDef.availableWeights

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

    // Start rest timer after logging reps
    setTimerKey(k => k + 1)
    setTimerVisible(true)

    // Auto-advance after all sets done
    const allDone = currentEx.sets.every((s, i) =>
      i === activeSetIdx ? true : s.completed
    )
    if (allDone && currentExIdx < plan.length - 1) {
      setTimeout(() => {
        setCurrentExIdx(idx => idx + 1)
        setSwapShown(false)
        setTimerVisible(false)
      }, 600)
    }
  }

  function confirmWeight(value: number) {
    if (activeSetIdx === null) return
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx] }
      const sets = [...ex.sets]
      // Always update THIS set's weight, even if completed
      // Pre-fill uncompleted subsequent sets too
      sets[activeSetIdx] = { ...sets[activeSetIdx], weight: value }
      for (let i = activeSetIdx + 1; i < sets.length; i++) {
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

  function swapToBackup() {
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx] }
      // Swap primary and backup names
      const prevPrimary = ex.exerciseName
      ex.exerciseName = ex.backupName
      ex.backupName = prevPrimary
      next[currentExIdx] = ex
      return next
    })
    setSwapShown(false)
  }

  async function handleFinish() {
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const entries: any[] = []

    for (const exLog of logs) {
      for (let si = 0; si < exLog.sets.length; si++) {
        const set = exLog.sets[si]
        if (!set.completed) continue
        entries.push({
          exercise: exLog.exerciseName,
          date: today,
          split,
          weight: set.weight,
          set: si + 1,
          reps: set.reps,
          entry: `${exLog.exerciseName} — Set ${si + 1}`,
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

  // Weight pad: if availableWeights defined, show step picker; else freeform
  function WeightInput() {
    if (activeSetIdx === null) return null
    const currentWeight = currentEx.sets[activeSetIdx].weight

    if (availableWeights && availableWeights.length > 0) {
      return (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(10,10,10,0.97)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.12em', margin: '0 0 8px 0' }}>
              SET {activeSetIdx + 1} — {activeUnit === 'pins' ? 'PIN' : 'WEIGHT'}
            </p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 24px 0' }}>
              {currentEx.exerciseName}
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              width: '100%',
              maxWidth: '320px',
            }}>
              {availableWeights.map(w => (
                <button
                  key={w}
                  onClick={() => confirmWeight(w)}
                  style={{
                    padding: '16px 8px',
                    background: currentWeight === w ? 'var(--accent)' : 'var(--surface)',
                    color: currentWeight === w ? '#0A0A0A' : 'var(--text-primary)',
                    border: `1px solid ${currentWeight === w ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '4px',
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '1rem',
                    fontWeight: currentWeight === w ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {activeUnit === 'pins' ? w : w}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: '0 24px 32px' }}>
            <button
              onClick={() => { setPadMode(null); setActiveSetIdx(null) }}
              style={{
                width: '100%', background: 'none', border: '1px solid var(--border)',
                borderRadius: '4px', padding: '14px',
                color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )
    }

    return (
      <NumberPad
        initialValue={currentWeight || null}
        onConfirm={confirmWeight}
        onCancel={() => { setPadMode(null); setActiveSetIdx(null) }}
        label={`Set ${activeSetIdx + 1} — weight (${activeUnit})`}
        maxValue={999}
        allowDecimal={true}
      />
    )
  }

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100dvh' }}>
      {/* Back guard */}
      {backGuardVisible && (
        <BackGuardModal
          onResume={() => setBackGuardVisible(false)}
          onGoBack={() => onBack(logs, currentExIdx)}
        />
      )}

      {/* Overview modal */}
      {overviewVisible && (
        <WorkoutOverviewModal
          plan={plan}
          logs={logs}
          currentExIdx={currentExIdx}
          onClose={() => setOverviewVisible(false)}
        />
      )}

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
          onClick={() => setBackGuardVisible(true)}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem', padding: '4px' }}
        >
          ←
        </button>

        {/* Overview button */}
        <button
          onClick={() => setOverviewVisible(true)}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: '4px',
            color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', fontSize: '0.65rem',
            letterSpacing: '0.08em', padding: '5px 10px', cursor: 'pointer',
          }}
        >
          {currentExIdx + 1} / {plan.length} · OVERVIEW
        </button>

        {allCurrentSetsDone && isLastExercise ? (
          <button
            onClick={handleFinish}
            disabled={saving}
            style={{
              background: 'var(--accent)', color: '#0A0A0A',
              border: 'none', borderRadius: '4px', padding: '8px 14px',
              fontFamily: 'DM Mono, monospace', fontSize: '0.75rem', fontWeight: 600,
              letterSpacing: '0.08em', cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'SAVING...' : 'FINISH'}
          </button>
        ) : (
          <div style={{ width: '60px' }} />
        )}
      </div>

      {/* Exercise name + controls */}
      <div className="px-5 py-4" style={{ flexShrink: 0 }}>
        <h2
          style={{
            fontSize: '1.4rem', fontFamily: 'DM Mono, monospace', fontWeight: 500,
            color: 'var(--text-primary)', margin: '0 0 6px 0', lineHeight: 1.2,
          }}
        >
          {currentEx.exerciseName}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>
            {exerciseDef.sets}×
            {exerciseDef.repRange[0] === exerciseDef.repRange[1]
              ? exerciseDef.repRange[0]
              : `${exerciseDef.repRange[0]}–${exerciseDef.repRange[1]}`} reps
          </span>

          {/* Unit toggle */}
          <button
            onClick={toggleUnit}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px',
              color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', fontSize: '0.6rem',
              letterSpacing: '0.08em', padding: '3px 8px', cursor: 'pointer',
            }}
          >
            {activeUnit.toUpperCase()}
          </button>

          {/* Swap button */}
          <button
            className="swap-badge"
            onClick={() => setSwapShown(s => !s)}
          >
            {swapShown ? 'HIDE' : 'SWAP'}
          </button>
        </div>

        {/* Backup exercise row */}
        {swapShown && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>
              {currentEx.backupName}
            </span>
            <button
              onClick={swapToBackup}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px',
                color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: '0.6rem',
                letterSpacing: '0.08em', padding: '3px 8px', cursor: 'pointer',
              }}
            >
              USE THIS
            </button>
          </div>
        )}
      </div>

      <div className="divider" />

      {/* Rest timer */}
      {timerVisible && (
        <div className="px-5 pt-3" style={{ flexShrink: 0 }}>
          <RestTimer key={timerKey} onDismiss={() => setTimerVisible(false)} />
        </div>
      )}

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
              {set.completed && <span style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>✓</span>}
            </div>

            <div className="flex items-center justify-between mt-3">
              {/* Weight — always tappable, even after completed */}
              <button
                onClick={() => openWeightPad(i)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', padding: 0,
                }}
              >
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em' }}>
                  {activeUnit === 'pins' ? 'PIN' : 'WEIGHT'}
                </span>
                <span className="font-mono-display" style={{ fontSize: '2rem', fontWeight: 500, color: set.weight > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {set.weight > 0 ? (activeUnit === 'pins' ? set.weight : set.weight) : '—'}
                  {set.weight > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                      {getWeightSuffix()}
                    </span>
                  )}
                </span>
              </button>

              {/* Reps */}
              <button
                onClick={() => openRepPad(i)}
                style={{
                  background: set.completed ? 'rgba(200,241,53,0.08)' : 'var(--surface)',
                  border: `1px solid ${set.completed ? 'rgba(200,241,53,0.3)' : 'var(--border)'}`,
                  borderRadius: '4px', padding: '12px 18px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: '80px',
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
              marginTop: '8px', padding: '16px',
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
              onClick={() => { setCurrentExIdx(i => i + 1); setSwapShown(false); setTimerVisible(false) }}
              style={{
                marginTop: '12px', width: '100%',
                background: 'var(--accent)', color: '#0A0A0A',
                border: 'none', borderRadius: '4px', padding: '12px',
                fontFamily: 'DM Mono, monospace', fontSize: '0.8rem', fontWeight: 600,
                letterSpacing: '0.08em', cursor: 'pointer',
              }}
            >
              NEXT EXERCISE →
            </button>
          </div>
        )}
      </div>

      {/* Pads */}
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
        <WeightInput />
      )}
    </div>
  )
}
