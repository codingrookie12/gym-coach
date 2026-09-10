'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { CARDIO_RECOMMENDATION } from '@/lib/routines'
import { SessionExercisePlan } from '@/lib/sessionPlan'
import { ExerciseLog, SavedSnapshot } from '@/lib/store'
import { planAutosave } from '@/lib/autosavePlan'
import { saveSessionToStorage } from '@/lib/sessionStorage'
import NumberPad from '@/components/ui/NumberPad'
import ChipGrid from '@/components/ui/ChipGrid'
import AddExerciseSheet from '@/components/AddExerciseSheet'
import ExercisePickerSheet from '@/components/ExercisePickerSheet'
import Toast from '@/components/ui/Toast'
import { savePendingExercise } from '@/lib/customExercises'
import { ExerciseDefinition, excludeOtherSessionNames, findExerciseByName, getAlternatives, getUniqueEquipment } from '@/lib/exerciseLibrary'
import ExerciseDetailSheet from '@/components/ExerciseDetailSheet'
import EquipmentInstanceSheet from '@/components/EquipmentInstanceSheet'
import { resolveEquipmentType } from '@/lib/equipmentType'
import { convertMass, convertPresetLadder, roundMass } from '@/lib/weightConversion'
import { resolvePersistedUnit, nextMassUnit, weightUnitLabelKey, resolveActiveMassUnit } from '@/lib/setUnit'
import { EquipmentInstance, getEquipmentInstances, resolveInstanceMass } from '@/lib/equipmentInstances'

interface ActiveSessionScreenProps {
  userId: string
  split: string
  plan: SessionExercisePlan[]
  initialLogs?: ExerciseLog[]
  initialExIdx?: number
  initialSnapshot?: SavedSnapshot
  startedAt?: string
  /** GYM-97 fix #1: required to persist the mid-session per-exercise
   *  autosave (see the effect below) — without it, /api/session/write's
   *  group key has no userProgramSplitId and the insert is silently
   *  skipped even though the route still returns success:true. */
  userProgramSplitId?: string
  onFinish: (logs: ExerciseLog[], snapshot: SavedSnapshot) => void
  onBack: (logs: ExerciseLog[], exIdx: number, snapshot: SavedSnapshot) => void
  onSessionSwap?: (oldName: string, newName: string) => void
}

type PadMode = 'reps' | 'weight' | null

// RIR chip scale — Phase 1/2/3 joint contract (sets.rir): integer 0-5+.
// '5+' is the open-ended top bucket (stored as 5), matching
// lib/coaching/rir.ts's clampRir ceiling.
const RIR_CHOICES = [0, 1, 2, 3, 4, 5] as const

// ── Rest Timer (timestamp-based, background-safe) ─────────────────────────────
function RestTimer() {
  const t = useTranslations('screens.activeSession')
  const [targetMinutes, setTargetMinutes] = useState(3)
  const [startTs, setStartTs] = useState<number | null>(null)     // ms timestamp when started
  const [elapsed, setElapsed] = useState(0)                        // seconds, for display
  const [finished, setFinished] = useState(false)
  const rafRef = useRef<number | null>(null)

  const targetSeconds = targetMinutes * 60

  // Tick loop — uses requestAnimationFrame but derives elapsed from wall clock
  const tick = useCallback(() => {
    if (startTs === null) return
    const now = Date.now()
    const secs = Math.floor((now - startTs) / 1000)
    setElapsed(secs)
    if (secs >= targetSeconds) {
      setFinished(true)
      setStartTs(null)
    } else {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [startTs, targetSeconds])

  useEffect(() => {
    if (startTs !== null) {
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [startTs, tick])

  const running = startTs !== null
  const remaining = Math.max(targetSeconds - elapsed, 0)
  const progress = targetSeconds > 0 ? Math.min(elapsed / targetSeconds, 1) : 0
  const done = finished

  function start() {
    setFinished(false)
    setElapsed(0)
    setStartTs(Date.now())
  }

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setStartTs(null)
    setElapsed(0)
    setFinished(false)
  }

  function adjustMinutes(delta: number) {
    setTargetMinutes(m => Math.max(1, Math.min(10, m + delta)))
    stop()
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const r = 20
  const circ = 2 * Math.PI * r
  const dash = circ * progress
  const circleColor = !running && !done ? 'var(--border-2)' : done ? 'var(--accent)' : 'var(--rust)'

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
            {running ? fmt(remaining) : done ? '0:00' : fmt(targetSeconds)}
          </span>
          {done && <span className="section-label" style={{ color: 'var(--accent)' }}>{t('restDone')}</span>}
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

      {/* Actions — START when idle, RESET+STOP when running or done */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {!running && !done ? (
          <button onClick={start} style={timerActionBtn('var(--accent)', 'var(--on-accent)', true)}>{t('start')}</button>
        ) : (
          <>
            <button onClick={start} style={timerActionBtn('var(--surface-2)', 'var(--text-primary)', false)}>{t('reset')}</button>
            <button onClick={stop} style={timerActionBtn('var(--surface-2)', 'var(--text-secondary)', false)}>{t('stop')}</button>
          </>
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
  plan, logs, currentExIdx, split, onNavigate, onClose, onAddExercise, onRemoveExercise,
}: {
  plan: SessionExercisePlan[]
  logs: ExerciseLog[]
  currentExIdx: number
  split: string
  onNavigate: (idx: number) => void
  onClose: () => void
  onAddExercise: () => void
  onRemoveExercise: (idx: number) => void
}) {
  const t = useTranslations('screens.activeSession')
  const cardio = CARDIO_RECOMMENDATION[split]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'var(--overlay)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div>
          <p className="section-label" style={{ margin: '0 0 2px 0' }}>{t('sessionOverview')}</p>
          <h2 className="font-display" style={{ fontSize: '1.6rem', margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            {logs.length} {t('exercisesLabel')}
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: '1px solid var(--border-2)', borderRadius: '2px', color: 'var(--text-mid)', fontFamily: 'Bebas Neue, sans-serif', fontSize: '0.95rem', letterSpacing: '0.08em', padding: '7px 14px', cursor: 'pointer' }}
        >
          {t('close')}
        </button>
      </div>

      <div style={{ overflow: 'auto', flex: 1, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {logs.map((log, i) => {
          const completedSets = log.sets.filter(s => s.completed).length
          const skipped = log.sets.every(s => s.skipped)
          const totalSets = log.sets.length
          const isCurrent = i === currentExIdx
          const isDone = completedSets === totalSets
          // GYM-95: removal is only safe when no set has been logged.
          // Once any set is completed, skip is the right tool (preserves data).
          const canRemove = completedSets === 0
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: '6px',
                background: isCurrent ? 'var(--accent-dim)' : 'var(--surface)',
                border: `1px solid ${isCurrent ? 'var(--accent-border)' : isDone ? 'rgba(212,241,58,0.12)' : 'var(--border)'}`,
                borderRadius: '2px',
              }}
            >
              <button
                onClick={() => { onNavigate(i); onClose() }}
                style={{
                  flex: 1,
                  padding: '11px 14px',
                  borderRadius: '2px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-sans" style={{ fontSize: '0.9rem', fontWeight: 600, color: isCurrent ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {log.exerciseName}
                      {isCurrent && <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', marginLeft: '8px' }}>← {t('nowLabel')}</span>}
                    </span>
                  </div>
                  <span className="font-mono" style={{ fontSize: '0.65rem', color: skipped ? 'var(--rust)' : isDone ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {skipped ? t('skip') : isDone ? '✓' : i <= currentExIdx ? `${completedSets}/${totalSets}` : '—'}
                  </span>
                </div>
              </button>
              {canRemove && (
                <button
                  onClick={() => onRemoveExercise(i)}
                  aria-label={`Remove ${log.exerciseName}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    transition: 'color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--rust)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: '2px', marginTop: '4px' }}>
          <span className="section-label" style={{ color: 'var(--accent)', flexShrink: 0 }}>{t('cardio')}</span>
          <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-mid)' }}>{cardio}</span>
        </div>

        <button
          onClick={() => { onClose(); onAddExercise() }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '11px 14px',
            marginTop: '4px',
            background: 'none',
            border: '1px dashed var(--border-2)',
            borderRadius: '2px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '0.9rem',
            letterSpacing: '0.1em',
            width: '100%',
          }}
        >
          {t('addExerciseButton')}
        </button>
      </div>
    </div>
  )
}

// ── Back Guard Modal ──────────────────────────────────────────────────────────
function BackGuardModal({ onResume, onGoBack }: { onResume: () => void; onGoBack: () => void }) {
  const t = useTranslations('screens.activeSession')
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
      <p className="section-label" style={{ margin: '0 0 10px 0' }}>{t('sessionInProgress')}</p>
      <h2 className="font-display" style={{ fontSize: '2.5rem', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 8px 0', textAlign: 'center', letterSpacing: '0.04em' }}>
        {t('goBackTitle')}
      </h2>
      <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-mid)', margin: '0 0 32px 0', textAlign: 'center', lineHeight: 1.7 }}>
        {t('goBackBody')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '280px' }}>
        <button className="btn-primary" onClick={onResume}>{t('keepGoing')}</button>
        <button className="btn-secondary" onClick={onGoBack}>{t('goBackConfirm')}</button>
      </div>
    </div>
  )
}

// ── Weight Input ──────────────────────────────────────────────────────────────
function WeightInput({
  activeSetIdx, currentEx, currentPlan, activeUnit, instanceCalibrationHint, onConfirm, onCancel,
}: {
  activeSetIdx: number
  currentEx: ExerciseLog
  currentPlan: SessionExercisePlan
  activeUnit: 'lbs' | 'pins' | 'kg'
  /** Informational only (see lib/equipmentInstances.ts's resolveInstanceMass)
   *  — a specific pin-stack instance's calibrated real-mass estimate for the
   *  currently-entered pin count, or null when abstract-scale/uncalibrated/
   *  no instance selected. Never changes what gets stored (still a raw pin
   *  count) — see lib/setUnit.ts's resolvePersistedUnit docstring. */
  instanceCalibrationHint?: string | null
  onConfirm: (v: number) => void
  onCancel: () => void
}) {
  const t = useTranslations('screens.activeSession')
  const common = useTranslations('common')
  const numberPadT = useTranslations('numberPad')
  const rawAvailableWeights = currentPlan.exercise.availableWeights
  // availableWeights (lib/routines.ts's ladders) are always lbs-denominated —
  // convert+snap to real loadable values when displaying in kg. Never
  // reconvert on a value the user types directly (NumberPad path below).
  //
  // Live-verification finding (Playwright, gym-coach-dev, 2026-09-09): a
  // dense lbs ladder (5lb steps) converted through the 2.5-unit kg rounding
  // grid produces genuine duplicate values — e.g. 25 lbs and 30 lbs both
  // round to 12.5 kg — which both confuses the chip grid (two chips read
  // "12.5") and throws a React duplicate-key warning (ChipGrid keys chips by
  // value). Deduping is correct, not lossy: two source lbs values that round
  // to the identical displayed kg number really do offer the user the same
  // outcome once converted, so collapsing them to one chip is the accurate
  // representation, not an approximation.
  const availableWeights = activeUnit === 'kg'
    ? rawAvailableWeights ? convertPresetLadder(rawAvailableWeights, 'kg') : undefined
    : rawAvailableWeights
  const currentWeight = currentEx.sets[activeSetIdx].weight
  const [showCustom, setShowCustom] = useState(false)

  if (showCustom || !availableWeights || availableWeights.length === 0) {
    return (
      <NumberPad
        initialValue={currentWeight || null}
        onConfirm={onConfirm}
        onCancel={() => {
          if (showCustom && availableWeights && availableWeights.length > 0) {
            setShowCustom(false)
          } else {
            onCancel()
          }
        }}
        label={numberPadT('weightLabel', { setNumber: activeSetIdx + 1, unit: common(weightUnitLabelKey(activeUnit)) })}
        maxValue={999}
        allowDecimal={true}
      />
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--overlay)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
        <p className="section-label" style={{ margin: '0 0 4px 0' }}>
          {t('setLabel', { setNumber: activeSetIdx + 1 })} — {activeUnit === 'pins' ? t('pin') : t('weight')}
        </p>
        <p className="font-sans" style={{ fontSize: '1rem', color: 'var(--text-mid)', margin: '0 0 24px 0', fontWeight: 500 }}>{currentEx.exerciseName}</p>
        <ChipGrid
          values={availableWeights}
          selectedValue={currentWeight}
          onSelect={onConfirm}
          onCustomValue={() => setShowCustom(true)}
          maxWidth={320}
        />
        {instanceCalibrationHint && (
          <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '14px' }}>
            {instanceCalibrationHint}
          </p>
        )}
      </div>
      <div style={{ padding: '0 24px 32px' }}>
        <button className="btn-secondary" onClick={onCancel}>{t('cancel')}</button>
      </div>
    </div>
  )
}

// ── RIR Row — Phase 3: persistent inline explainer, not one-time onboarding ──
// GYM-97 fix #5: `explainerOpen` lives inside this component (not lifted to
// the screen) — RirRow renders once per set, and nothing outside it needs to
// read this toggle, so scoping it here keeps each set's "?" independent
// instead of one boolean toggling every set's explainer at once.
function RirRow({
  value, onSelect,
}: {
  value: number | null | undefined
  onSelect: (v: number | null) => void
}) {
  const t = useTranslations('screens.activeSession')
  const [explainerOpen, setExplainerOpen] = useState(false)
  return (
    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span className="section-label">{t('rirLabel')}</span>
        <button
          onClick={() => setExplainerOpen(o => !o)}
          aria-label={t('rirExplainerAriaLabel')}
          style={{
            background: explainerOpen ? 'var(--accent-dim)' : 'none',
            border: `1px solid ${explainerOpen ? 'var(--accent-border)' : 'var(--border-2)'}`,
            borderRadius: '50%',
            color: explainerOpen ? 'var(--accent)' : 'var(--text-secondary)',
            width: '18px',
            height: '18px',
            minWidth: '18px',
            fontSize: '0.6rem',
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Space Mono, monospace',
            padding: 0,
          }}
        >
          ?
        </button>
      </div>
      {explainerOpen && (
        <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-mid)', lineHeight: 1.6, margin: '0 0 10px 0' }}>
          {t('rirExplainerText')}
        </p>
      )}
      {/* GYM-97 fix #8: reuse ChipGrid (already used below for WeightInput)
         instead of a bespoke button grid — it enforces the 44×44px tap-target
         floor (the Phase 1 checker gate); the old grid was 38px. */}
      <ChipGrid
        values={RIR_CHOICES as unknown as number[]}
        selectedValue={value ?? null}
        onSelect={v => onSelect(value === v ? null : v)}
        formatValue={v => (v === 5 ? '5+' : String(v))}
        columns={6}
        maxWidth="100%"
      />
    </div>
  )
}

// ── Notes Input ───────────────────────────────────────────────────────────────
function NotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations('screens.activeSession')
  const [expanded, setExpanded] = useState(!!value)

  return (
    <div style={{ marginTop: '8px' }}>
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: '1px dashed var(--border-2)',
            borderRadius: '2px',
            color: 'var(--text-secondary)',
            fontFamily: 'Space Mono, monospace',
            fontSize: '0.55rem',
            letterSpacing: '0.08em',
            padding: '6px 12px',
            cursor: 'pointer',
            width: '100%',
            justifyContent: 'flex-start',
          }}
        >
          {t('addNote')}
        </button>
      ) : (
        <div style={{ position: 'relative' }}>
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={t('notesPlaceholder')}
            autoFocus
            className="notes-area"
            style={{
              width: '100%',
              minHeight: '72px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '2px',
              color: 'var(--text-primary)',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.7rem',
              lineHeight: 1.6,
              padding: '10px 12px',
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {!value && (
            <button
              onClick={() => setExpanded(false)}
              style={{
                position: 'absolute',
                top: '6px',
                right: '8px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontFamily: 'Space Mono, monospace',
                fontSize: '0.55rem',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              {t('notesHide')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ActiveSessionScreen({
  userId, split, plan, initialLogs, initialExIdx = 0, initialSnapshot, startedAt, userProgramSplitId, onFinish, onBack, onSessionSwap,
}: ActiveSessionScreenProps) {
  const t = useTranslations('screens.activeSession')
  const common = useTranslations('common')
  const numberPadT = useTranslations('numberPad')
  const [logs, setLogs] = useState<ExerciseLog[]>(() =>
    initialLogs ??
    plan.map(item => ({
      exerciseName: item.exercise.name,
      canonicalName: item.exercise.canonicalName,
      backupName: item.exercise.backup,
      sets: Array.from({ length: item.exercise.sets }, () => ({
        weight: item.targetWeight ?? 0,
        reps: 0,
        completed: false,
        skipped: false,
        rir: null,
      })),
      notes: '',
    }))
  )

  const [currentExIdx, setCurrentExIdx] = useState(initialExIdx)
  const [activeSetIdx, setActiveSetIdx] = useState<number | null>(null)
  const [padMode, setPadMode] = useState<PadMode>(null)
  const [flashSet, setFlashSet] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  // Mass-based (barbell/dumbbell/plate-loaded) in-session lbs<->kg override,
  // per exercise index — replaces the old lbs/pins `unitOverrides`. See
  // toggleMassUnit() below: converts already-entered weights (not just the
  // display) so what's shown always matches what gets persisted (lib/
  // weightConversion.ts's documented "convert-then-snap, never relabel"
  // contract). Abstract-scale (pin-stack) exercises don't use this — they
  // always display/persist 'pins' (lib/setUnit.ts's resolvePersistedUnit is
  // authoritative there), with equipment-instance selection as their
  // equivalent affordance instead (instanceOverrides below).
  const [massUnitOverrides, setMassUnitOverrides] = useState<Record<number, 'lbs' | 'kg'>>({})
  // Equipment-instance (lib/equipmentInstances.ts) tagged per exercise index,
  // THIS session only — see components/EquipmentInstanceSheet.tsx's
  // docstring for why this doesn't persist a routine-level default (yet).
  // Untouched (no key) = identical to today's behavior.
  const [instanceOverrides, setInstanceOverrides] = useState<Record<number, string | null>>({})
  const [equipmentInstances, setEquipmentInstances] = useState<EquipmentInstance[]>([])
  const [loadingInstances, setLoadingInstances] = useState(false)
  const [showInstanceSheet, setShowInstanceSheet] = useState(false)
  const [overviewVisible, setOverviewVisible] = useState(false)
  const [backGuardVisible, setBackGuardVisible] = useState(false)
  const [swapShown, setSwapShown] = useState(false)
  const [pendingSwapName, setPendingSwapName] = useState<string | null>(null)
  const [showSwapPicker, setShowSwapPicker] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [detailExercise, setDetailExercise] = useState<ExerciseDefinition | null>(null)
  // GYM-95: pending in-memory logs op with 3s Undo. Mid-session is today-only;
  // no routine prompt (per plan). `flush` is a no-op — there's no DB write to
  // defer for mid-session add/remove.
  interface PendingLogsOp {
    message: string
    undo: () => void
    timeoutId: ReturnType<typeof setTimeout>
  }
  const [pendingLogsOp, setPendingLogsOp] = useState<PendingLogsOp | null>(null)
  const pendingLogsOpRef = useRef<PendingLogsOp | null>(null)
  useEffect(() => { pendingLogsOpRef.current = pendingLogsOp }, [pendingLogsOp])

  function startLogsOp(op: PendingLogsOp) {
    const prev = pendingLogsOpRef.current
    if (prev) clearTimeout(prev.timeoutId)
    setPendingLogsOp(op)
    pendingLogsOpRef.current = op
  }
  function handleUndoLogsOp() {
    const op = pendingLogsOpRef.current
    if (!op) return
    clearTimeout(op.timeoutId)
    op.undo()
    setPendingLogsOp(null)
    pendingLogsOpRef.current = null
  }
  // Snapshot: maps "exerciseName:setNum" -> { pageId (Supabase set UUID), weight, reps, notes }
  const snapshot = useRef<SavedSnapshot>(initialSnapshot ?? {})
  // Track which exercise indices have been auto-saved (to avoid double-fire)
  const savedExIndices = useRef<Set<number>>(new Set(
    initialSnapshot
      ? Object.keys(initialSnapshot).map(k => {
          // Recover which exercise indices were already saved
          const canonicalName = k.split(':')[0]
          return plan.findIndex(p => p.exercise.canonicalName === canonicalName)
        }).filter(i => i >= 0)
      : []
  ))

  // Fetched once per session — cheap, read-only, backs both the equipment-
  // instance sheet and the calibration hint below. A user who never opens
  // an abstract-scale exercise never sees any effect of this.
  useEffect(() => {
    let cancelled = false
    setLoadingInstances(true)
    getEquipmentInstances(userId).then(list => {
      if (!cancelled) setEquipmentInstances(list)
    }).finally(() => {
      if (!cancelled) setLoadingInstances(false)
    })
    return () => { cancelled = true }
  }, [userId])

  const currentEx = logs[currentExIdx]
  const currentPlan: SessionExercisePlan = currentExIdx < plan.length ? plan[currentExIdx] : {
    exercise: {
      name: currentEx.exerciseName,
      canonicalName: currentEx.exerciseName,
      sets: 1,
      repRange: [1, 20] as [number, number],
      backup: null,
      split,
      availableWeights: [] as number[],
      weightUnit: 'lbs' as const,
    },
    exerciseId: '',
    targetWeightOrigin: null,
    targetWeight: null,
    flags: [],
  }
  const exerciseDef = currentPlan.exercise
  // Precedence rule 2 (lib/equipmentType.ts's resolveEquipmentType docstring):
  // no `exercises.equipment_type` column data is wired into SessionExercisePlan
  // yet (that requires the still-unapplied migration + a sessionPlan query
  // change — out of scope here), so this falls back to the pre-existing
  // weightUnit==='pins' signal — reproducing today's implicit behavior
  // exactly for any exercise nobody interacts with.
  const equipmentType = resolveEquipmentType({ weightUnit: exerciseDef.weightUnit })
  // See lib/setUnit.ts's resolveActiveMassUnit docstring — critically, this
  // consults currentEx.unit (not just the routine's static default) so a
  // resumed session (fresh mount, massUnitOverrides starts empty) whose log
  // already carries a prior toggle's resolved 'Kg' keeps showing Kg, since
  // the set weights stored in that log are already real kg values.
  const activeMassUnit: 'lbs' | 'kg' = resolveActiveMassUnit(
    massUnitOverrides[currentExIdx],
    currentEx.unit,
    exerciseDef.weightUnit
  )
  const activeUnit: 'lbs' | 'kg' | 'pins' = equipmentType === 'abstract-scale' ? 'pins' : activeMassUnit
  const currentInstanceId = instanceOverrides[currentExIdx] ?? currentEx.equipmentInstanceId ?? null
  const currentInstance = equipmentInstances.find(i => i.id === currentInstanceId) ?? null

  // Persist session to localStorage on every change for resume detection
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    saveSessionToStorage(userId, {
      date: today,
      split,
      exIdx: currentExIdx,
      logs,
      snapshot: snapshot.current,
      ...(startedAt ? { startedAt } : {}),
    })
  }, [logs, currentExIdx, split, startedAt])

  const [showSaved, setShowSaved] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flashSaved() {
    // Mutually exclusive with the error flash: a fresh success for one
    // exercise shouldn't leave a stale "SAVE FAILED" badge (up to 2.6s)
    // lingering alongside it from a different exercise's earlier attempt.
    if (saveErrorTimerRef.current) {
      clearTimeout(saveErrorTimerRef.current)
      saveErrorTimerRef.current = null
    }
    setShowSaveError(false)
    setShowSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 1800)
  }

  // GYM-97 fast-follow: mirrors the flashSaved()/showSaved pattern above,
  // but for the autosave-failed path (route returned success:false, or the
  // fetch itself threw). Without this the screen gave no visible feedback —
  // it just silently waited for the next autosave retry on the next logs
  // change.
  const [showSaveError, setShowSaveError] = useState(false)
  const saveErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flashSaveError() {
    // Mutually exclusive with the success flash — see flashSaved() above.
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current)
      savedTimerRef.current = null
    }
    setShowSaved(false)
    setShowSaveError(true)
    if (saveErrorTimerRef.current) clearTimeout(saveErrorTimerRef.current)
    saveErrorTimerRef.current = setTimeout(() => setShowSaveError(false), 2600)
  }

  // Auto-save when all sets of an exercise are done.
  //
  // GYM: duplicate-set fix — snapshot-aware, mirrors app/page.tsx's
  // handleSaveSession (see lib/autosavePlan.ts's planAutosave docstring for
  // the full root-cause writeup). A set already recorded in `snapshot.current`
  // is only ever patched (via /api/session/update), never re-inserted — so a
  // late RIR/notes edit re-arming `savedExIndices` below can no longer
  // reinsert every already-saved set in the exercise a second time.
  useEffect(() => {
    const ex = logs[currentExIdx]
    const allDone = ex.sets.every(s => s.completed || s.skipped)
    if (!allDone) return

    // Only auto-save once per exercise (on first completion)
    if (savedExIndices.current.has(currentExIdx)) return
    savedExIndices.current.add(currentExIdx)

    const today = new Date().toISOString().split('T')[0]
    // ex.unit is set by toggleMassUnit() below when the user has actively
    // toggled this session (already fully resolved, incl. equipment type) —
    // prefer it so what's displayed always matches what's persisted. Falling
    // back to resolvePersistedUnit(undefined, ...) reproduces today's
    // behavior exactly for any exercise nobody toggles (see lib/setUnit.ts).
    const unit = ex.unit ?? resolvePersistedUnit(undefined, exerciseDef.weightUnit, equipmentType)
    const { toInsert, insertSetNumbers, toPatch } = planAutosave(
      ex,
      { date: today, split, weightUnit: unit, userProgramSplitId, equipmentInstanceId: ex.equipmentInstanceId },
      snapshot.current
    )
    if (toInsert.length === 0 && toPatch.length === 0) return

    const writePromise = toInsert.length > 0
      ? fetch('/api/session/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: toInsert, ...(startedAt ? { startedAt } : {}) }),
        }).then(r => r.json())
      : Promise.resolve(null)

    const patchPromises = toPatch.map(op =>
      fetch('/api/session/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: op.pageId, changes: op.changes }),
      }).then(r => r.json())
    )

    Promise.all([writePromise, Promise.all(patchPromises)])
      .then(([writeData, patchResults]) => {
        let anyFailure = false

        if (writeData) {
          // GYM-97 fix #1 (defense-in-depth): the route returns
          // success:false when it can't persist (e.g. missing
          // userProgramSplitId) instead of lying with success:true.
          if (writeData.success === false) {
            anyFailure = true
            console.error('Auto-save reported failure:', writeData.error ?? writeData)
          } else if (writeData.pageIds && Array.isArray(writeData.pageIds)) {
            writeData.pageIds.forEach((pageId: string, i: number) => {
              const key = `${ex.exerciseName}:${insertSetNumbers[i]}`
              snapshot.current[key] = {
                pageId,
                weight: toInsert[i].weight,
                reps: toInsert[i].reps,
                notes: toInsert[i].notes ?? '',
                rir: toInsert[i].rir ?? null,
              }
            })
          }
        }

        patchResults.forEach((res, i) => {
          if (res?.success === false) {
            anyFailure = true
            console.error('Auto-save patch failed:', res?.error ?? res)
            return
          }
          const op = toPatch[i]
          snapshot.current[op.key] = { pageId: op.pageId, ...op.resolved }
        })

        // Never flash "✓ SAVED" — or mark this exercise as fully saved — if
        // any part of the batch failed; allow the next logs change to retry.
        if (anyFailure) {
          savedExIndices.current.delete(currentExIdx)
          flashSaveError()
          return
        }
        flashSaved()
      })
      .catch(e => {
        savedExIndices.current.delete(currentExIdx)
        console.error('Auto-save failed:', e)
        flashSaveError()
      })
  }, [logs, currentExIdx, split, exerciseDef, equipmentType, userProgramSplitId, startedAt])

  // Mass-based lbs<->kg toggle. Converts every already-entered weight in
  // this exercise (not just the display) — a physical weight is the same
  // weight regardless of when it was logged, so leaving stale numbers in
  // the old unit while flipping the label would be exactly the
  // "relabel-without-converting" bug lib/weightConversion.ts's header warns
  // about. Never offered for abstract-scale exercises (see the `equipmentType
  // === 'mass-based'` gate at the call site) — 'pins' never enters this path.
  function toggleMassUnit() {
    const from = activeMassUnit
    const to = nextMassUnit(from)
    setMassUnitOverrides(prev => ({ ...prev, [currentExIdx]: to }))
    setLogs(prev => {
      const next = [...prev]
      const ex = next[currentExIdx]
      next[currentExIdx] = {
        ...ex,
        sets: ex.sets.map(s => (s.weight > 0 ? { ...s, weight: roundMass(convertMass(s.weight, from, to)) } : s)),
        unit: resolvePersistedUnit(to, exerciseDef.weightUnit, equipmentType),
      }
      return next
    })
    // Weights changed under already-saved sets — allow re-save so the
    // corrected weight+unit reaches the DB instead of the stale pre-toggle
    // pair (see the write route's server-side dedup guard: it updates the
    // existing row in place, it does not create a duplicate).
    savedExIndices.current.delete(currentExIdx)
  }

  function handleSelectInstance(instanceId: string | null) {
    setInstanceOverrides(prev => ({ ...prev, [currentExIdx]: instanceId }))
    setLogs(prev => {
      const next = [...prev]
      next[currentExIdx] = { ...next[currentExIdx], equipmentInstanceId: instanceId }
      return next
    })
  }

  function handleInstanceCreated(instance: EquipmentInstance) {
    setEquipmentInstances(prev => [...prev, instance].sort((a, b) => a.name.localeCompare(b.name)))
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
    // If this exercise was previously saved, allow re-save on next change
    savedExIndices.current.delete(currentExIdx)
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

  function selectRir(setIdx: number, value: number | null) {
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx], sets: [...next[currentExIdx].sets] }
      ex.sets[setIdx] = { ...ex.sets[setIdx], rir: value }
      next[currentExIdx] = ex
      return next
    })
    // A RIR change after auto-save (e.g. logged reps first, RIR a moment
    // later) must still make it to the DB — allow re-save.
    savedExIndices.current.delete(currentExIdx)
  }

  function updateNotes(value: string) {
    setLogs(prev => {
      const next = [...prev]
      next[currentExIdx] = { ...next[currentExIdx], notes: value }
      return next
    })
    // Allow re-save if notes changed
    savedExIndices.current.delete(currentExIdx)
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
      setShowSwapPicker(false)
    }
  }

  function swapToExercise(newName: string) {
    const oldName = currentEx.exerciseName
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx] }
      ex.exerciseName = newName
      ex.backupName = oldName  // old primary becomes revert option
      next[currentExIdx] = ex
      return next
    })
    onSessionSwap?.(oldName, newName)
    setPendingSwapName(null)
    setSwapShown(false)
    setShowSwapPicker(false)
  }

  function getSwapOptions(): string[] {
    const options: string[] = []
    if (currentEx.backupName) options.push(currentEx.backupName)
    const def = findExerciseByName(currentEx.exerciseName)
    if (def) {
      const alts = getAlternatives(def, {
        availableEquipment: getUniqueEquipment(),
        excludeNames: [currentEx.exerciseName, ...(currentEx.backupName ? [currentEx.backupName] : [])],
        limit: 2,
      })
      options.push(...alts.map(a => a.name))
    }
    return options
  }

  function getSwapExcludeNames(): string[] {
    return excludeOtherSessionNames(logs.map(l => l.exerciseName), currentExIdx)
  }

  function navigateToExercise(idx: number) {
    setCurrentExIdx(idx)
    setSwapShown(false)
    setPendingSwapName(null)
    setShowSwapPicker(false)
    setPadMode(null)
    setActiveSetIdx(null)
  }

  const allCurrentSetsDone = currentEx.sets.every(s => s.completed || s.skipped)
  const isLastExercise = currentExIdx === logs.length - 1
  const allExercisesDone = logs.every(ex => ex.sets.every(s => s.completed || s.skipped))

  function addQuickExercise(name: string, matched: ExerciseDefinition | null, prefillWeight: number | null, prefillReps: number | null) {
    const avgSets = logs.length > 0
      ? Math.max(1, Math.round(logs.reduce((s, l) => s + l.sets.length, 0) / logs.length))
      : 3
    const newLog: ExerciseLog = {
      exerciseName: name,
      canonicalName: name,
      backupName: null,
      sets: Array.from({ length: avgSets }, () => ({
        weight: prefillWeight ?? 0,
        reps: prefillReps ?? 0,
        completed: false,
        skipped: false,
        rir: null,
      })),
      notes: '',
      isCustom: matched === null,
    }
    if (matched === null) savePendingExercise(userId, name)
    setLogs(prev => [...prev, newLog])
    setShowAddSheet(false)

    const undo = () => {
      setLogs(prev => prev.filter(l => l !== newLog))
    }
    const timeoutId = setTimeout(() => {
      setPendingLogsOp(null)
      pendingLogsOpRef.current = null
    }, 3000)
    startLogsOp({ message: `${name} added`, undo, timeoutId })
  }

  function removeExerciseFromSession(index: number) {
    const entry = logs[index]
    if (!entry) return
    const originalCurrentIdx = currentExIdx

    setLogs(prev => prev.filter((_, i) => i !== index))

    // Re-target currentExIdx so the now-vacated slot resolves to a valid
    // exercise. Removing the last exercise pulls focus back by one.
    const newLen = logs.length - 1
    let newCurrentIdx = currentExIdx
    if (index < currentExIdx) newCurrentIdx = currentExIdx - 1
    else if (index === currentExIdx) newCurrentIdx = Math.min(currentExIdx, newLen - 1)
    newCurrentIdx = Math.max(0, newCurrentIdx)
    if (newCurrentIdx !== currentExIdx) setCurrentExIdx(newCurrentIdx)

    const undo = () => {
      setLogs(prev => {
        const next = [...prev]
        next.splice(index, 0, entry)
        return next
      })
      setCurrentExIdx(originalCurrentIdx)
    }
    const timeoutId = setTimeout(() => {
      setPendingLogsOp(null)
      pendingLogsOpRef.current = null
    }, 3000)
    startLogsOp({ message: `${entry.exerciseName} removed for today`, undo, timeoutId })
  }

  const totalSets = logs.reduce((acc, ex) => acc + ex.sets.length, 0)
  const completedSets = logs.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed || s.skipped).length, 0)
  const progressPct = totalSets > 0 ? (completedSets / totalSets) * 100 : 0

  function skipSet(setIdx: number) {
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx], sets: [...next[currentExIdx].sets] }
      ex.sets[setIdx] = { ...ex.sets[setIdx], skipped: true, completed: false, reps: 0 }
      next[currentExIdx] = ex
      return next
    })
    savedExIndices.current.delete(currentExIdx)
  }

  function unskipSet(setIdx: number) {
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx], sets: [...next[currentExIdx].sets] }
      ex.sets[setIdx] = { ...ex.sets[setIdx], skipped: false }
      next[currentExIdx] = ex
      return next
    })
    savedExIndices.current.delete(currentExIdx)
  }

  function addSet() {
    setLogs(prev => {
      const next = [...prev]
      const ex = { ...next[currentExIdx], sets: [...next[currentExIdx].sets] }
      const lastSet = ex.sets[ex.sets.length - 1]
      ex.sets = [...ex.sets, { weight: lastSet?.weight ?? 0, reps: 0, completed: false, skipped: false, rir: null }]
      next[currentExIdx] = ex
      return next
    })
    savedExIndices.current.delete(currentExIdx)
  }

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100dvh' }}>
      {backGuardVisible && <BackGuardModal onResume={() => setBackGuardVisible(false)} onGoBack={() => onBack(logs, currentExIdx, snapshot.current)} />}
      {overviewVisible && (
        <WorkoutOverviewModal
          plan={plan} logs={logs} currentExIdx={currentExIdx} split={split}
          onNavigate={navigateToExercise} onClose={() => setOverviewVisible(false)}
          onAddExercise={() => setShowAddSheet(true)}
          onRemoveExercise={removeExerciseFromSession}
        />
      )}
      {pendingLogsOp && (
        <Toast
          message={pendingLogsOp.message}
          onUndo={handleUndoLogsOp}
          onTimeout={() => {
            setPendingLogsOp(null)
            pendingLogsOpRef.current = null
          }}
        />
      )}
      {showAddSheet && (
        <AddExerciseSheet
          onAdd={addQuickExercise}
          onClose={() => setShowAddSheet(false)}
        />
      )}
      {showSwapPicker && (
        <ExercisePickerSheet
          split={split}
          excludeNames={getSwapExcludeNames()}
          swapTarget={findExerciseByName(currentEx.exerciseName) ?? undefined}
          userId={userId}
          onSelect={(def) => swapToExercise(def.name)}
          onClose={() => setShowSwapPicker(false)}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {showSaveError && (
            <span className="save-error-indicator font-mono" style={{ fontSize: '0.55rem', color: 'var(--rust)', letterSpacing: '0.1em' }}>
              ⚠ {t('saveErrorIndicator')}
            </span>
          )}
          {showSaved && (
            <span className="saved-indicator font-mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', letterSpacing: '0.1em' }}>
              ✓ {t('savedIndicator')}
            </span>
          )}
          <button
            onClick={() => setOverviewVisible(true)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-mid)', fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.06em', padding: '5px 10px', cursor: 'pointer' }}
          >
            {currentExIdx + 1}/{plan.length} · {t('overviewLabel')}
          </button>
        </div>
        {/* Fixed-content spacer preserves header layout balance without a
           hardcoded pixel width — CLAUDE.md's localized-text rule
           (a `width: '60px'` spacer here, eyeballed to balance the English
           word "FINISH", broke under Spanish "TERMINAR"). Rendering the
           real FINISH button with visibility:hidden auto-sizes to
           whatever locale/length is active instead. */}
        {allExercisesDone ? (
          <button
            onClick={() => onFinish(logs, snapshot.current)}
            disabled={saving}
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: '2px', padding: '8px 16px', fontFamily: 'Bebas Neue, sans-serif', fontSize: '1rem', letterSpacing: '0.1em', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {t('finish')}
          </button>
        ) : (
          <button
            aria-hidden="true"
            tabIndex={-1}
            style={{ background: 'var(--accent)', border: 'none', borderRadius: '2px', padding: '8px 16px', fontFamily: 'Bebas Neue, sans-serif', fontSize: '1rem', letterSpacing: '0.1em', visibility: 'hidden', pointerEvents: 'none' }}
          >
            {t('finish')}
          </button>
        )}
      </div>

      {/* Exercise name + controls */}
      <div className="px-5 py-4" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <h2 className="font-display" style={{ fontSize: '2rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1, letterSpacing: '0.03em' }}>
            {currentEx.exerciseName}
          </h2>
          <button
            onClick={() => setDetailExercise(findExerciseByName(currentEx.exerciseName) ?? null)}
            style={{ background: 'none', border: 'none', color: 'var(--border-2)', cursor: 'pointer', fontSize: '1.1rem', padding: '4px', flexShrink: 0, lineHeight: 1 }}
          >
            ⓘ
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--text-mid)' }}>
            {exerciseDef.sets}×{exerciseDef.repRange[0] === exerciseDef.repRange[1] ? exerciseDef.repRange[0] : `${exerciseDef.repRange[0]}–${exerciseDef.repRange[1]}`} {t('reps').toLowerCase()}
          </span>
          {equipmentType === 'mass-based' ? (
            <button
              onClick={toggleMassUnit}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.08em', padding: '3px 8px', cursor: 'pointer' }}
            >
              {activeUnit === 'kg' ? t('unitKg') : t('unitLbs')}
            </button>
          ) : (
            <button
              onClick={() => setShowInstanceSheet(true)}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.08em', padding: '3px 8px', cursor: 'pointer' }}
            >
              {t('machineButton')}{currentInstance ? ` · ${currentInstance.name}` : ''}
            </button>
          )}
          <button className="swap-badge" onClick={() => setSwapShown(s => !s)}>
            {swapShown ? t('hide') : common('swap')}
          </button>
          <button
            onClick={skipExercise}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.08em', padding: '3px 8px', cursor: 'pointer' }}
          >
            {t('skip')}
          </button>
        </div>
        {swapShown && (() => {
          const options = getSwapOptions()

          // Confirmation step
          if (pendingSwapName) return (
            <div style={{ marginTop: '10px' }}>
              <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-mid)', marginBottom: '10px', lineHeight: 1.5 }}>
                {t('replaceWith', { oldName: currentEx.exerciseName, newName: pendingSwapName })}
                <br />
                <span style={{ color: 'var(--text-secondary)' }}>{t('swapNote')}</span>
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => swapToExercise(pendingSwapName)}
                  style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: '2px', color: 'var(--on-accent)', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.08em', padding: '8px', cursor: 'pointer' }}
                >
                  {t('confirmSwap')}
                </button>
                <button
                  onClick={() => setPendingSwapName(null)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.08em', padding: '8px 14px', cursor: 'pointer' }}
                >
                  {t('cancel2')}
                </button>
              </div>
            </div>
          )

          return (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {options.length === 0 ? (
                <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {t('noAlternatives')}
                </p>
              ) : (
                options.map(altName => (
                  <div key={altName} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="font-sans" style={{ fontSize: '0.85rem', color: 'var(--text-mid)', fontWeight: 500, flex: 1 }}>
                      {altName}
                    </span>
                    <button
                      onClick={() => setPendingSwapName(altName)}
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--accent-border)', borderRadius: '2px', color: 'var(--accent)', fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.08em', padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}
                    >
                      {t('useNow')}
                    </button>
                  </div>
                ))
              )}
              <button
                onClick={() => setShowSwapPicker(true)}
                style={{ background: 'none', border: '1px solid var(--border-2)', borderRadius: '2px', color: 'var(--text-mid)', fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.08em', padding: '6px 8px', cursor: 'pointer', marginTop: options.length === 0 ? '4px' : 0 }}
              >
                {common('browseAll')}
              </button>
            </div>
          )
        })()}
      </div>

      <div className="divider" />

      {/* Timer */}
      <div className="px-5 pt-3" style={{ flexShrink: 0 }}>
        <RestTimer />
      </div>

      {/* Sets */}
      <div className="scroll-area flex-1 px-5 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {currentEx.sets.map((set, i) => {
          const isSkipped = set.skipped
          return (
            <div
              key={i}
              className={`${flashSet === i ? 'set-complete-flash' : ''}`}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${set.completed ? 'var(--accent-border)' : isSkipped ? 'var(--rust-border)' : 'var(--border)'}`,
                borderLeft: set.completed ? '3px solid var(--accent)' : isSkipped ? '3px solid var(--rust)' : '1px solid var(--border)',
                borderRadius: '0 2px 2px 0',
                padding: '14px',
                transition: 'border-color 0.2s',
                opacity: isSkipped ? 0.5 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span className="section-label">{t('setLabel', { setNumber: i + 1 })}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {set.completed && <span style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>✓</span>}
                  {isSkipped ? (
                    <button
                      onClick={() => unskipSet(i)}
                      style={{ background: 'none', border: '1px solid var(--rust-border)', borderRadius: '2px', color: 'var(--rust)', fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.08em', padding: '2px 7px', cursor: 'pointer' }}
                    >
                      {t('skippedUndo')}
                    </button>
                  ) : (
                    !set.completed && (
                      <button
                        onClick={() => skipSet(i)}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.08em', padding: '2px 7px', cursor: 'pointer' }}
                      >
                        {t('skip')}
                      </button>
                    )
                  )}
                </div>
              </div>

              {!isSkipped && (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    {/* Weight */}
                    <button
                      onClick={() => openWeightPad(i)}
                      className="weight-btn"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', padding: 0 }}
                    >
                      <span className="section-label">{activeUnit === 'pins' ? t('pin') : t('weight')}</span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span className="font-display" style={{ fontSize: '2.8rem', lineHeight: 1, color: set.weight > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', letterSpacing: '0.02em' }}>
                          {set.weight > 0 ? set.weight : '—'}
                        </span>
                        {set.weight > 0 && activeUnit !== 'pins' && (
                          <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{t(activeUnit === 'kg' ? 'unitKg' : 'unitLbs').toLowerCase()}</span>
                        )}
                      </div>
                    </button>

                    {/* Reps */}
                    <button
                      onClick={() => openRepPad(i)}
                      className="reps-btn"
                      style={{
                        background: set.completed ? 'var(--accent-dim)' : 'var(--surface-2)',
                        border: `1px solid ${set.completed ? 'var(--accent-border)' : 'var(--border)'}`,
                        borderRadius: '2px',
                        padding: '0 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 0,
                        minWidth: '72px',
                        alignSelf: 'stretch',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span className="section-label" style={{ paddingTop: '2px' }}>{t('reps')}</span>
                      <span className="font-display" style={{ fontSize: '2.8rem', lineHeight: 1, color: set.reps > 0 ? 'var(--accent)' : 'var(--text-secondary)', letterSpacing: '0.02em', paddingBottom: '2px' }}>
                        {set.reps > 0 ? set.reps : '—'}
                      </span>
                    </button>
                  </div>

                  {/* RIR — persistent inline explainer, every set, every time */}
                  <RirRow
                    value={set.rir}
                    onSelect={v => selectRir(i, v)}
                  />
                </>
              )}
            </div>
          )
        })}

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
          {t('addSet')}
        </button>

        {/* Notes field */}
        <NotesField
          value={currentEx.notes ?? ''}
          onChange={updateNotes}
        />

        {/* Next exercise preview */}
        {allCurrentSetsDone && !isLastExercise && (
          <div style={{ marginTop: '6px', padding: '16px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: '2px' }}>
            <p className="section-label" style={{ color: 'var(--accent)', margin: '0 0 4px 0' }}>{t('nextUp')}</p>
            <p className="font-sans" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>
              {logs[currentExIdx + 1]?.exerciseName ?? ''}
            </p>
            <button
              onClick={() => { setCurrentExIdx(i => i + 1); setSwapShown(false) }}
              className="btn-primary"
            >
              {t('nextExercise')}
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
          label={numberPadT('repsLabel', { setNumber: activeSetIdx + 1 })}
          maxValue={99}
        />
      )}
      {padMode === 'weight' && activeSetIdx !== null && (
        <WeightInput
          activeSetIdx={activeSetIdx}
          currentEx={currentEx}
          currentPlan={currentPlan}
          activeUnit={activeUnit}
          instanceCalibrationHint={(() => {
            if (activeUnit !== 'pins' || !currentInstance?.calibration) return null
            const pins = currentEx.sets[activeSetIdx].weight
            if (!pins || pins <= 0) return null
            const mass = resolveInstanceMass(currentInstance, pins, currentInstance.calibration.weightPerUnitMassUnit)
            if (mass === null) return null
            const rounded = Math.round(mass * 10) / 10
            return t('estimatedMass', { weight: rounded, unit: common(currentInstance.calibration.weightPerUnitMassUnit) })
          })()}
          onConfirm={confirmWeight}
          onCancel={() => { setPadMode(null); setActiveSetIdx(null) }}
        />
      )}
      {showInstanceSheet && (
        <EquipmentInstanceSheet
          userId={userId}
          exerciseName={currentEx.exerciseName}
          currentInstanceId={currentInstanceId}
          instances={equipmentInstances}
          loading={loadingInstances}
          onSelect={handleSelectInstance}
          onCreated={handleInstanceCreated}
          onClose={() => setShowInstanceSheet(false)}
        />
      )}
      {detailExercise && (
        <ExerciseDetailSheet exercise={detailExercise} inProgram={true} onClose={() => setDetailExercise(null)} />
      )}
    </div>
  )
}
