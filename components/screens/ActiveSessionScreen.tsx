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

  const r = 22
  const circ = 2 * Math.PI * r
  const dash = circ * progress

  const circleColor = !running ? 'var(--text-secondary)'
    : done ? 'var(--accent)'
    : '#ff6464'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        background: done ? 'rgba(200,241,53,0.06)'
          : running ? 'rgba(255,100,100,0.05)'
          : 'var(--surface)',
        border: `1px solid ${done ? 'rgba(200,241,53,0.3)' : running ? 'rgba(255,100,100,0.2)' : 'var(--border)'}`,
        borderRadius: '6px',
        flexShrink: 0,
        transition: 'all 0.3s',
      }}
    >
      {/* Circle */}
      <svg width="52" height="52" style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle
          cx="26" cy="26" r={r} fill="none"
          stroke={circleColor}
          strokeWidth="3"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s linear, stroke 0.3s' }}
        />
      </svg>

      {/* Time + controls */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
          <span
            className="font-mono-display"
            style={{
              fontSize: '1.4rem', fontWeight: 500, lineHeight: 1,
              color: done ? 'var(--accent)' : running ? '#ff6464' : 'var(--text-secondary)',
            }}
          >
            {running ? fmt(remaining) : fmt(targetSeconds)}
          </span>
          {done && (
            <span style={{ fontSize: '0.65rem', color: 'var(--accent)', fontFamily: 'DM Mono, monospace' }}>
              REST DONE
            </span>
          )}
        </div>

        {/* Target minutes adjuster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => adjustMinutes(-1)} style={adjBtnStyle}>−</button>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', minWidth: '36px', textAlign: 'center' }}>
            {targetMinutes} min
          </span>
          <button onClick={() => adjustMinutes(1)} style={adjBtnStyle}>+</button>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {!running ? (
          <button onClick={start} style={timerActionBtn('var(--accent)', '#0A0A0A')}>
            START
          </button>
        ) : (
          <button onClick={pause} style={timerActionBtn('var(--surface)', 'var(--text-primary)')}>
            PAUSE
          </button>
        )}
        {(running || elapsed > 0) && (
          <button onClick={stop} style={timerActionBtn('var(--surface)', 'var(--text-secondary)')}>
            STOP
          </button>
        )}
      </div>
    </div>
  )
}

const adjBtnStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px',
  color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace', fontSize: '0.9rem',
  width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
}

function timerActionBtn(bg: string, color: string): React.CSSProperties {
  return {
    background: bg, border: '1px solid var(--border)', borderRadius: '3px',
    color, fontFamily: 'DM Mono, monospace', fontSize: '0.6rem',
    letterSpacing: '0.06em', padding: '4px 8px', cursor: 'pointer', fontWeight: 600,
  }
}

// ── Workout Overview Modal ────────────────────────────────────────────────────
function WorkoutOverviewModal({
  plan, logs, currentExIdx, split,
  onNavigate, onClose,
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(10,10,10,0.97)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.12em', margin: 0 }}>SESSION OVERVIEW</p>
          <h2 style={{ fontSize: '1.1rem', fontFamily: 'DM Mono, monospace', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
            {plan.length} exercises
          </h2>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', fontSize: '0.8rem', padding: '8px 12px', cursor: 'pointer' }}>
          CLOSE
        </button>
      </div>
      <div style={{ overflow: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                padding: '12px 14px', borderRadius: '4px', textAlign: 'left', cursor: 'pointer',
                background: isCurrent ? 'rgba(200,241,53,0.04)' : 'var(--surface)',
                border: `1px solid ${isCurrent ? 'rgba(200,241,53,0.25)' : isDone ? 'rgba(200,241,53,0.15)' : 'var(--border)'}`,
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontSize: '0.85rem', color: isCurrent ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {log.exerciseName}
                    {isCurrent && <span style={{ fontSize: '0.6rem', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', marginLeft: '6px' }}>← NOW</span>}
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', fontFamily: 'DM Mono, monospace', color: skipped ? '#ffa500' : isDone ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {skipped ? 'SKIPPED' : isDone ? '✓ done' : i <= currentExIdx ? `${completedSets}/${totalSets}` : '—'}
                </span>
              </div>
            </button>
          )
        })}

        {/* Cardio */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(200,241,53,0.04)', border: '1px solid rgba(200,241,53,0.15)', borderRadius: '4px', marginTop: '4px' }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', flexShrink: 0 }}>CARDIO</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{cardio}</span>
        </div>
      </div>
    </div>
  )
}

// ── Back Guard Modal ──────────────────────────────────────────────────────────
function BackGuardModal({ onResume, onGoBack }: { onResume: () => void; onGoBack: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(10,10,10,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.12em', margin: '0 0 12px 0' }}>SESSION IN PROGRESS</p>
      <h2 style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.2rem', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 8px 0', textAlign: 'center' }}>Go back?</h2>
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 32px 0', textAlign: 'center', lineHeight: 1.6 }}>
        Your progress is saved. You can resume from where you left off.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '280px' }}>
        <button onClick={onResume} style={{ width: '100%', background: 'var(--accent)', color: '#0A0A0A', border: 'none', borderRadius: '4px', padding: '16px', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.08em', cursor: 'pointer' }}>
          KEEP GOING
        </button>
        <button onClick={onGoBack} style={{ width: '100%', background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '14px', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.08em', cursor: 'pointer' }}>
          GO BACK (progress saved)
        </button>
      </div>
    </div>
  )
}

// ── Weight Input (step picker or freeform) ────────────────────────────────────
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
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(10,10,10,0.97)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.12em', margin: '0 0 6px 0' }}>
            SET {activeSetIdx + 1} — {activeUnit === 'pins' ? 'PIN' : 'WEIGHT'}
          </p>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 24px 0' }}>{currentEx.exerciseName}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', width: '100%', maxWidth: '320px' }}>
            {availableWeights.map(w => (
              <button key={w} onClick={() => onConfirm(w)} style={{
                padding: '16px 8px', borderRadius: '4px', cursor: 'pointer',
                background: currentWeight === w ? 'var(--accent)' : 'var(--surface)',
                color: currentWeight === w ? '#0A0A0A' : 'var(--text-primary)',
                border: `1px solid ${currentWeight === w ? 'var(--accent)' : 'var(--border)'}`,
                fontFamily: 'DM Mono, monospace', fontSize: '1rem',
                fontWeight: currentWeight === w ? 600 : 400,
              }}>{w}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: '0 24px 32px' }}>
          <button onClick={onCancel} style={{ width: '100%', background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '14px', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem', cursor: 'pointer' }}>
            Cancel
          </button>
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
        <div className="progress-bar-fill" style={{ width: `${(currentExIdx / plan.length) * 100}%` }} />
      </div>

      {/* Header */}
      <div className="safe-top flex items-center justify-between px-5" style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => setBackGuardVisible(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem', padding: '4px' }}>←</button>
        <button onClick={() => setOverviewVisible(true)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.08em', padding: '5px 10px', cursor: 'pointer' }}>
          {currentExIdx + 1} / {plan.length} · OVERVIEW
        </button>
        {allExercisesDone ? (
          <button
            onClick={() => onFinish(logs)}
            disabled={saving}
            style={{ background: 'var(--accent)', color: '#0A0A0A', border: 'none', borderRadius: '4px', padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            FINISH
          </button>
        ) : (
          <div style={{ width: '60px' }} />
        )}
      </div>

      {/* Exercise name + controls */}
      <div className="px-5 py-4" style={{ flexShrink: 0 }}>
        <h2 style={{ fontSize: '1.4rem', fontFamily: 'DM Mono, monospace', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 6px 0', lineHeight: 1.2 }}>
          {currentEx.exerciseName}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>
            {exerciseDef.sets}×{exerciseDef.repRange[0] === exerciseDef.repRange[1] ? exerciseDef.repRange[0] : `${exerciseDef.repRange[0]}–${exerciseDef.repRange[1]}`} reps
          </span>
          <button onClick={toggleUnit} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.08em', padding: '3px 8px', cursor: 'pointer' }}>
            {activeUnit.toUpperCase()}
          </button>
          <button className="swap-badge" onClick={() => setSwapShown(s => !s)}>
            {swapShown ? 'HIDE' : 'SWAP'}
          </button>
          <button
            onClick={skipExercise}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.08em', padding: '3px 8px', cursor: 'pointer' }}
          >
            SKIP
          </button>
        </div>
        {swapShown && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>{currentEx.backupName}</span>
            <button onClick={swapToBackup} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.08em', padding: '3px 8px', cursor: 'pointer' }}>
              USE THIS
            </button>
          </div>
        )}
      </div>

      <div className="divider" />

      {/* Timer — always visible */}
      <div className="px-5 pt-3" style={{ flexShrink: 0 }}>
        <RestTimer />
      </div>

      {/* Sets */}
      <div className="scroll-area flex-1 px-5 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {currentEx.sets.map((set, i) => {
          const isSkipped = set.skipped
          return (
            <div
              key={i}
              className={`card p-4 ${flashSet === i ? 'set-complete-flash' : ''}`}
              style={{ borderColor: set.completed ? 'rgba(200,241,53,0.3)' : isSkipped ? 'rgba(255,165,0,0.2)' : 'var(--border)', transition: 'border-color 0.2s', opacity: isSkipped ? 0.5 : 1 }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono-display" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>SET {i + 1}</span>
                {set.completed && <span style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>✓</span>}
                {isSkipped && <span style={{ color: '#ffa500', fontSize: '0.7rem', fontFamily: 'DM Mono, monospace' }}>SKIPPED</span>}
              </div>
              <div className="flex items-center justify-between mt-3">
                {/* Weight — always tappable */}
                <button
                  onClick={() => !isSkipped && openWeightPad(i)}
                  style={{ background: 'none', border: 'none', cursor: isSkipped ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', padding: 0 }}
                >
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em' }}>
                    {activeUnit === 'pins' ? 'PIN' : 'WEIGHT'}
                  </span>
                  <span className="font-mono-display" style={{ fontSize: '2rem', fontWeight: 500, color: set.weight > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {set.weight > 0 ? set.weight : '—'}
                    {set.weight > 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                        {activeUnit === 'pins' ? '' : 'lbs'}
                      </span>
                    )}
                  </span>
                </button>
                {/* Reps */}
                <button
                  onClick={() => !isSkipped && openRepPad(i)}
                  style={{ background: set.completed ? 'rgba(200,241,53,0.08)' : 'var(--surface)', border: `1px solid ${set.completed ? 'rgba(200,241,53,0.3)' : 'var(--border)'}`, borderRadius: '4px', padding: '12px 18px', cursor: isSkipped ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: '80px' }}
                >
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em' }}>REPS</span>
                  <span className="font-mono-display" style={{ fontSize: '2rem', fontWeight: 500, color: set.reps > 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {set.reps > 0 ? set.reps : '—'}
                  </span>
                </button>
              </div>
            </div>
          )
        })}

        {/* Next exercise preview */}
        {allCurrentSetsDone && !isLastExercise && (
          <div style={{ marginTop: '8px', padding: '16px', background: 'rgba(200,241,53,0.04)', border: '1px solid rgba(200,241,53,0.15)', borderRadius: '4px' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', margin: '0 0 4px 0' }}>NEXT UP</p>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0 }}>{plan[currentExIdx + 1].exercise.name}</p>
            <button
              onClick={() => { setCurrentExIdx(i => i + 1); setSwapShown(false) }}
              style={{ marginTop: '12px', width: '100%', background: 'var(--accent)', color: '#0A0A0A', border: 'none', borderRadius: '4px', padding: '12px', fontFamily: 'DM Mono, monospace', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.08em', cursor: 'pointer' }}
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
