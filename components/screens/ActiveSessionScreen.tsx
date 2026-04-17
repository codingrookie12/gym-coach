'use client'

import { useState, useEffect, useRef } from 'react'
import { Split, CARDIO_RECOMMENDATION } from '@/lib/routines'
import { ExercisePlan } from '@/lib/coaching'
import { ExerciseLog } from '@/lib/store'
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
function RestTimer() {
  const [targetMinutes, setTargetMinutes] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const targetSeconds = targetMinutes * 60
  const remaining = Math.max(targetSeconds - elapsed, 0)
  const done = running && elapsed >= targetSeconds
  const progress = running ? Math.min(elapsed / targetSeconds, 1) : 0

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  function start() { setElapsed(0); setRunning(true) }
  function pause() { setRunning(false) }
  function stop() { setRunning(false); setElapsed(0) }
  function adjustMinutes(delta: number) {
    setTargetMinutes(m => Math.max(1, Math.min(10, m + delta)))
    if (running) stop()
  }
  function fmt(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const r = 20
  const circ = 2 * Math.PI * r
  const dash = circ * progress
  const circleColor = !running ? 'var(--border-2)' : done ? 'var(--accent)' : 'var(--rust)'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      padding: '10px 14px',
      background: done ? 'var(--accent-dim)' : running ? 'var(--rust-dim)' : 'var(--surface)',
      border: `1px solid ${done ? 'var(--accent-border)' : running ? 'var(--rust-border)' : 'var(--border)'}`,
      borderRadius: '2px',
      flexShrink: 0,
      transition: 'all 0.3s',
    }}>
      {/* Circle progress */}
      <svg width="48" height="48" style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--border)" strokeWidth="2.5" />
        <circle
          cx="24" cy="24" r={r} fill="none"
          stroke={circleColor}
          strokeWidth="2.5"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s linear, stroke 0.3s' }}
        />
      </svg>

      {/* Time + controls */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '5px' }}>
          <span className="font-display" style={{
            fontSize: '1.6rem',
            lineHeight: 1,
            color: done ? 'var(--accent)' : running ? 'var(--rust)' : 'var(--text-secondary)',
            letterSpacing: '0.04em',
          }}>
            {running ? fmt(remaining) : fmt(targetSeconds)}
          </span>
          {done && <span className="section-label" style={{ color: 'var(--accent)' }}>REST DONE</span>}
        </div>

        {/* Min adjuster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => adjustMinutes(-1)} style={adjBtnStyle}>−</button>
          <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', minWidth: '34px', textAlign: 'center' }}>
            {targetMinutes}m
          </span>
          <button onClick={() => adjustMinutes(1)} style={adjBtnStyle}>+</button>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {!running ? (
          <button onClick={start} style={timerActionBtn('var(--accent)', '#0C0B09', true)}>START</button>
        ) : (
          <button onClick={pause} style={timerActionBtn('var(--surface-2)', 'var(--text-primary)', false)}>PAUSE</button>
        )}
        {(running || elapsed > 0) && (
          <button onClick={stop} style={timerActionBtn('var(--surface-2)', 'var(--text-secondary)', false)}>STOP</button>
        )}
      </div>
    </div>
  )
}

const adjBtnStyle: React.CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '2px',
  color: 'var(--text-mid)', fontFamily: 'Space Mono, monospace', fontSize: '0.85rem',
  width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
}

function timerActionBtn(bg: string, color: string, isAccent: boolean): React.CSSProperties {
  return {
    background: bg,
    border: isAccent ? 'none' : '1px solid var(--border)',
    borderRadius: '2px',
    color,
    fontFamily: 'Bebas Neue, sans-serif',
    fontSize: '0.85rem',
    letterSpacing: '0.08em',
    padding: '4px 10px',
    cursor: 'pointer',
  }
}

// ── Workout Overview Modal ────────────────────────────────────────────────────
function WorkoutOverviewModal({
  plan, logs, currentExIdx, split, onNavigate, onClose,
}: {
  plan: ExercisePlan[]
  logs: ExerciseLog[]
  currentExIdx: number
  split: Split
  onNavigate: (idx: number) => void
  onClose: () => void
}) {
  const cardio = CARDIO_RECOMMENDATION[split]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(12,11,9,0.98)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div>
          <p className="section-label" style={{ margin: '0 0 2px 0' }}>SESSION OVERVIEW</p>
          <h2 className="font-display" style={{ fontSize: '1.6rem', margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            {plan.length} Exercises
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: '1px solid var(--border-2)', borderRadius: '2px', color: 'var(--text-mid)', fontFamily: 'Bebas Neue, sans-serif', fontSize: '0.95rem', letterSpacing: '0.08em', padding: '7px 14px', cursor: 'pointer' }}
        >
          CLOSE
        </button>
      </div>

      <div style={{ overflow: 'auto', flex: 1, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {plan.map((item, i) => {
          const log = logs[i]
          const completedSets = log.sets.filter(s => s.completed).length
          const skipped = log.sets.every(s => s.skipped)
          const totalSets = log.sets.length
          const isCurrent = i === currentExIdx
          const isDone = completedSets === totalSets
          return (
            <button
              key={i}
              onClick={() => { onNavigate(i); onClose() }}
              style={{
                padding: '11px 14px',
                borderRadius: '2px',
                textAlign: 'left',
                cursor: 'pointer',
                background: isCurrent ? 'var(--accent-dim)' : 'var(--surface)',
                border: `1px solid ${isCurrent ? 'var(--accent-border)' : isDone ? 'rgba(212,241,58,0.12)' : 'var(--border)'}`,
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-sans" style={{ fontSize: '0.9rem', fontWeight: 600, color: isCurrent ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {log.exerciseName}
                    {isCurrent && <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', marginLeft: '8px' }}>← NOW</span>}
                  </span>
                </div>
                <span className="font-mono" style={{ fontSize: '0.65rem', color: skipped ? 'var(--rust)' : isDone ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {skipped ? 'SKIP' : isDone ? '✓' : i <= currentExIdx ? `${completedSets}/${totalSets}` : '—'}
                </span>
              </div>
            </button>
          )
        })}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: '2px', marginTop: '4px' }}>
          <span className="section-label" style={{ color: 'var(--accent)', flexShrink: 0 }}>CARDIO</span>
          <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-mid)' }}>{cardio}</span>
        </div>
      </div>
    </div>
  )
}

// ── Back Guard Modal ──────────────────────────────────────────────────────────
function BackGuardModal({ onResume, onGoBack }: { onResume: () => void; onGoBack: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(12,11,9,0.98)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
      <p className="section-label" style={{ margin: '0 0 10px 0' }}>SESSION IN PROGRESS</p>
      <h2 className="font-display" style={{ fontSize: '2.5rem', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 8px 0', textAlign: 'center', letterSpacing: '0.04em' }}>
        Go Back?
      </h2>
      <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-mid)', margin: '0 0 32px 0', textAlign: 'center', lineHeight: 1.7 }}>
        Progress is saved. Resume any time.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '280px' }}>
        <button className="btn-primary" onClick={onResume}>KEEP GOING</button>
        <button className="btn-secondary" onClick={onGoBack}>GO BACK (progress saved)</button>
      </div>
    </div>
  )
}

// ── Weight Input ──────────────────────────────────────────────────────────────
function WeightInput({
  activeSetIdx, currentEx, currentPlan, activeUnit, onConfirm, onCancel,
}: {
  activeSetIdx: number
  currentEx: ExerciseLog
  currentPlan: ExercisePlan
  activeUnit: 'lbs' | 'pins'
  onConfirm: (v: number) => void
  onCancel: () => void
}) {
  const availableWeights = currentPlan.exercise.availableWeights
  const currentWeight = currentEx.sets[activeSetIdx].weight

  if (availableWeights && availableWeights.length > 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(12,11,9,0.98)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <p className="section-label" style={{ margin: '0 0 4px 0' }}>
            SET {activeSetIdx + 1} — {activeUnit === 'pins' ? 'PIN' : 'WEIGHT'}
          </p>
          <p className="font-sans" style={{ fontSize: '1rem', color: 'var(--text-mid)', margin: '0 0 24px 0', fontWeight: 500 }}>{currentEx.exerciseName}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', width: '100%', maxWidth: '320px' }}>
            {availableWeights.map(w => (
              <button key={w} onClick={() => onConfirm(w)} style={{
                padding: '18px 8px', borderRadius: '2px', cursor: 'pointer',
                background: currentWeight === w ? 'var(--accent)' : 'var(--surface-2)',
                color: currentWeight === w ? '#0C0B09' : 'var(--text-primary)',
                border: `1px solid ${currentWeight === w ? 'var(--accent)' : 'var(--border)'}`,
                fontFamily: 'Space Mono, monospace', fontSize: '0.9rem',
                fontWeight: currentWeight === w ? 700 : 400,
                transition: 'all 0.1s',
              }}>{w}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: '0 24px 32px' }}>
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <NumberPad
      initialValue={currentWeight || null}
      onConfirm={onConfirm}
      onCancel={onCancel}
      label={`Set ${activeSetIdx + 1} — weight (${activeUnit})`}
      maxValue={999}
      allowDecimal={true}
    />
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ActiveSessionScreen({
  split, plan, initialLogs, initialExIdx = 0, onFinish, onBack,
}: ActiveSessionScreenProps) {
  const [logs, setLogs] = useState<ExerciseLog[]>(() =>
    initialLogs ??
    plan.map(item => ({
      exerciseName: item.exercise.name,
      notionName: item.exercise.notionName,
      backupName: item.exercise.backup,
      sets: Array.from({ length: item.exercise.sets }, () => ({
        weight: item.targetWeight ?? 0,
        reps: 0,
        completed: false,
        skipped: false,
      })),
    }))
  )

  const [currentExIdx, setCurrentExIdx] = useState(initialExIdx)
  const [activeSetIdx, setActiveSetIdx] = useState<number | null>(null)
  const [padMode, setPadMode] = useState<PadMode>(null)
  const [flashSet, setFlashSet] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [unitOverrides, setUnitOverrides] = useState<Record<number, 'lbs' | 'pins'>>({})
  const [overviewVisible, setOverviewVisible] = useState(false)
  const [backGuardVisible, setBackGuardVisible] = useState(false)
  const [swapShown, setSwapShown] = useState(false)

  const currentEx = logs[currentExIdx]
  const currentPlan = plan[currentExIdx]
  const exerciseDef = currentPlan.exercise
  const defaultUnit = exerciseDef.weightUnit ?? 'lbs'
  const activeUnit = unitOverrides[currentExIdx] ?? defaultUnit

  function toggleUnit() {
    setUnitOverrides(prev => ({
      ...prev,
      [currentExIdx]: (prev[currentExIdx] ?? defaultUnit) === 'pins' ? 'lbs' : 'pins',
    }))
  }

  function openRepPad(setIdx: number) { setActiveSetIdx(setIdx); setPadMode('reps') }
  function openWeightPad(setIdx: number) { setActiveSetIdx(setIdx); setPadMode('weight') }

  function confirmReps(value: number) {
    if (activeSetIdx === null) return
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx], sets: [...next[currentExIdx].sets] }
      ex.sets[activeSetIdx] = { ...ex.sets[activeSetIdx], reps: value, completed: true, skipped: false }
      next[currentExIdx] = ex
      return next
    })
    setFlashSet(activeSetIdx)
    setTimeout(() => setFlashSet(null), 500)
    setPadMode(null)
    setActiveSetIdx(null)
  }

  function confirmWeight(value: number) {
    if (activeSetIdx === null) return
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx], sets: [...next[currentExIdx].sets] }
      ex.sets[activeSetIdx] = { ...ex.sets[activeSetIdx], weight: value }
      for (let i = activeSetIdx + 1; i < ex.sets.length; i++) {
        if (!ex.sets[i].completed) ex.sets[i] = { ...ex.sets[i], weight: value }
      }
      next[currentExIdx] = ex
      return next
    })
    setPadMode(null)
    setActiveSetIdx(null)
  }

  function skipExercise() {
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx] }
      ex.sets = ex.sets.map(s => ({ ...s, skipped: true, completed: false, reps: 0 }))
      next[currentExIdx] = ex
      return next
    })
    if (currentExIdx < plan.length - 1) {
      setCurrentExIdx(i => i + 1)
      setSwapShown(false)
    }
  }

  function swapToBackup() {
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx] }
      const prevPrimary = ex.exerciseName
      ex.exerciseName = ex.backupName
      ex.backupName = prevPrimary
      next[currentExIdx] = ex
      return next
    })
    setSwapShown(false)
  }

  function navigateToExercise(idx: number) {
    setCurrentExIdx(idx)
    setSwapShown(false)
    setPadMode(null)
    setActiveSetIdx(null)
  }

  const allCurrentSetsDone = currentEx.sets.every(s => s.completed || s.skipped)
  const isLastExercise = currentExIdx === plan.length - 1
  const allExercisesDone = logs.every(ex => ex.sets.every(s => s.completed || s.skipped))

  // Progress: completed sets / total sets across all exercises
  const totalSets = logs.reduce((acc, ex) => acc + ex.sets.length, 0)
  const completedSets = logs.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed || s.skipped).length, 0)
  const progressPct = totalSets > 0 ? (completedSets / totalSets) * 100 : 0

  function addSet() {
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx], sets: [...next[currentExIdx].sets] }
      const lastSet = ex.sets[ex.sets.length - 1]
      ex.sets = [...ex.sets, { weight: lastSet?.weight ?? 0, reps: 0, completed: false, skipped: false }]
      next[currentExIdx] = ex
      return next
    })
  }

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100dvh' }}>
      {backGuardVisible && <BackGuardModal onResume={() => setBackGuardVisible(false)} onGoBack={() => onBack(logs, currentExIdx)} />}
      {overviewVisible && (
        <WorkoutOverviewModal
          plan={plan} logs={logs} currentExIdx={currentExIdx} split={split}
          onNavigate={navigateToExercise} onClose={() => setOverviewVisible(false)}
        />
      )}

      {/* Progress bar */}
      <div className="progress-bar" style={{ flexShrink: 0 }}>
        <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Header */}
      <div className="safe-top flex items-center justify-between px-5" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          onClick={() => setBackGuardVisible(true)}
          style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', padding: '4px' }}
        >
          ←
        </button>
        <button
          onClick={() => setOverviewVisible(true)}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-mid)', fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.06em', padding: '5px 10px', cursor: 'pointer' }}
        >
          {currentExIdx + 1}/{plan.length} · OVERVIEW
        </button>
        {allExercisesDone ? (
          <button
            onClick={() => onFinish(logs)}
            disabled={saving}
            style={{ background: 'var(--accent)', color: '#0C0B09', border: 'none', borderRadius: '2px', padding: '8px 16px', fontFamily: 'Bebas Neue, sans-serif', fontSize: '1rem', letterSpacing: '0.1em', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            FINISH
          </button>
        ) : (
          <div style={{ width: '60px' }} />
        )}
      </div>

      {/* Exercise name + controls */}
      <div className="px-5 py-4" style={{ flexShrink: 0 }}>
        <h2 className="font-display" style={{ fontSize: '2rem', color: 'var(--text-primary)', margin: '0 0 8px 0', lineHeight: 1, letterSpacing: '0.03em' }}>
          {currentEx.exerciseName}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-mid)' }}>
            {exerciseDef.sets}×{exerciseDef.repRange[0] === exerciseDef.repRange[1] ? exerciseDef.repRange[0] : `${exerciseDef.repRange[0]}–${exerciseDef.repRange[1]}`} reps
          </span>
          <button
            onClick={toggleUnit}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.08em', padding: '3px 8px', cursor: 'pointer' }}
          >
            {activeUnit.toUpperCase()}
          </button>
          <button className="swap-badge" onClick={() => setSwapShown(s => !s)}>
            {swapShown ? 'HIDE' : 'SWAP'}
          </button>
          <button
            onClick={skipExercise}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.08em', padding: '3px 8px', cursor: 'pointer' }}
          >
            SKIP
          </button>
        </div>
        {swapShown && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <span className="font-sans" style={{ fontSize: '0.85rem', color: 'var(--text-mid)', fontWeight: 500 }}>{currentEx.backupName}</span>
            <button
              onClick={swapToBackup}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--accent-border)', borderRadius: '2px', color: 'var(--accent)', fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.08em', padding: '3px 8px', cursor: 'pointer' }}
            >
              USE THIS
            </button>
          </div>
        )}
      </div>

      <div className="divider" />

      {/* Timer */}
      <div className="px-5 pt-3" style={{ flexShrink: 0 }}>
        <RestTimer />
      </div>

      {/* Sets */}
      <div className="scroll-area flex-1 px-5 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {currentEx.sets.map((set, i) => (
          <div
            key={i}
            className={`${flashSet === i ? 'set-complete-flash' : ''}`}
            style={{
              background: 'var(--surface)',
              border: `1px solid ${set.completed ? 'var(--accent-border)' : 'var(--border)'}`,
              borderLeft: set.completed ? '3px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: set.completed ? '0 2px 2px 0' : '2px',
              padding: '14px',
              transition: 'border-color 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span className="section-label">SET {i + 1}</span>
              {set.completed && <span style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>✓</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              {/* Weight */}
              <button
                onClick={() => openWeightPad(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', padding: 0 }}
              >
                <span className="section-label">{activeUnit === 'pins' ? 'PIN' : 'WEIGHT'}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span className="font-display" style={{ fontSize: '2.2rem', lineHeight: 1, color: set.weight > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', letterSpacing: '0.02em' }}>
                    {set.weight > 0 ? set.weight : '—'}
                  </span>
                  {set.weight > 0 && activeUnit !== 'pins' && (
                    <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>lbs</span>
                  )}
                </div>
              </button>

              {/* Reps */}
              <button
                onClick={() => openRepPad(i)}
                style={{
                  background: set.completed ? 'var(--accent-dim)' : 'var(--surface-2)',
                  border: `1px solid ${set.completed ? 'var(--accent-border)' : 'var(--border)'}`,
                  borderRadius: '2px',
                  padding: '12px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  minWidth: '80px',
                  transition: 'all 0.15s',
                }}
              >
                <span className="section-label">REPS</span>
                <span className="font-display" style={{ fontSize: '2.2rem', lineHeight: 1, color: set.reps > 0 ? 'var(--accent)' : 'var(--text-secondary)', letterSpacing: '0.02em' }}>
                  {set.reps > 0 ? set.reps : '—'}
                </span>
              </button>
            </div>
          </div>
        ))}

        {/* Add Set button */}
        <button
          onClick={addSet}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '11px 14px',
            background: 'none',
            border: '1px dashed var(--border-2)',
            borderRadius: '2px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '0.9rem',
            letterSpacing: '0.1em',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
        >
          + ADD SET
        </button>

        {/* Next exercise preview */}
        {allCurrentSetsDone && !isLastExercise && (
          <div style={{ marginTop: '6px', padding: '16px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: '2px' }}>
            <p className="section-label" style={{ color: 'var(--accent)', margin: '0 0 4px 0' }}>NEXT UP</p>
            <p className="font-sans" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>
              {plan[currentExIdx + 1].exercise.name}
            </p>
            <button
              onClick={() => { setCurrentExIdx(i => i + 1); setSwapShown(false) }}
              className="btn-primary"
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
        <WeightInput
          activeSetIdx={activeSetIdx}
          currentEx={currentEx}
          currentPlan={currentPlan}
          activeUnit={activeUnit}
          onConfirm={confirmWeight}
          onCancel={() => { setPadMode(null); setActiveSetIdx(null) }}
        />
      )}
    </div>
  )
}
