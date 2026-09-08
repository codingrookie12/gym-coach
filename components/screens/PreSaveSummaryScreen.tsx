'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { SessionExercisePlan } from '@/lib/sessionPlan'
import { ExerciseLog } from '@/lib/store'
import NumberPad from '@/components/ui/NumberPad'

interface SessionSwap { oldName: string; newName: string }

interface PreSaveSummaryScreenProps {
  split: string
  plan: SessionExercisePlan[]
  logs: ExerciseLog[]
  sessionSwaps?: SessionSwap[]
  /** GYM-97 fix #7: lifted to appState by the caller (app/page.tsx) so
   *  going back to fix a set and returning here doesn't remount this
   *  screen back to a blank RPE selection. */
  sessionRpe: number | null
  onSessionRpeChange: (value: number | null) => void
  onSave: (logs: ExerciseLog[]) => Promise<void>
  onBack: () => void
  onSetDefault?: (oldName: string, newName: string) => Promise<void>
}

type EditTarget = { exIdx: number; setIdx: number; field: 'weight' | 'reps' } | null

// Session-level RPE (Borg CR10-style, 1-10) — Phase 1's workouts.session_rpe
// column, Phase 2's fatigue-deload signal input. A single optional tap here
// (Tier 2 placement choice, not spelled out by name in the plan — the
// review point before save is where "how did the whole session feel"
// naturally belongs). Skippable; never blocks save.
const RPE_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function PreSaveSummaryScreen({
  split, plan, logs: initialLogs, sessionSwaps = [], sessionRpe, onSessionRpeChange, onSave, onBack, onSetDefault,
}: PreSaveSummaryScreenProps) {
  const t = useTranslations('screens.preSaveSummary')
  const common = useTranslations('common')
  const [logs, setLogs] = useState<ExerciseLog[]>(initialLogs)
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [pendingDefault, setPendingDefault] = useState<SessionSwap | null>(null)
  const [settingDefault, setSettingDefault] = useState(false)
  const [defaultsDone, setDefaultsDone] = useState<Set<string>>(new Set())

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

  async function confirmSetDefault(swap: SessionSwap) {
    if (!onSetDefault) return
    setSettingDefault(true)
    try {
      await onSetDefault(swap.oldName, swap.newName)
      setDefaultsDone(prev => new Set(Array.from(prev).concat(swap.oldName)))
    } finally {
      setSettingDefault(false)
      setPendingDefault(null)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(false)
    try {
      await onSave(logs)
    } catch {
      setSaveError(true)
      setSaving(false)
    }
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
          <p className="section-label" style={{ margin: '0 0 2px 0' }}>{t('reviewSession')}</p>
          <h1 className="font-display" style={{ fontSize: '1.7rem', margin: 0, color: 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1 }}>
            {common('splitDay', { split })}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span className="tag accent">{t('setsTag', { count: totalCompleted })}</span>
          {totalSkipped > 0 && (
            <span className="tag rust">{t('skippedTag', { count: totalSkipped })}</span>
          )}
        </div>
      </div>

      <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: '10px 20px 0', flexShrink: 0, letterSpacing: '0.06em' }}>
        {t('tapToEdit')}
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
                          <span className="section-label" style={{ minWidth: '40px' }}>{t('setIndex', { setNumber: si + 1 })}</span>
                          <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--rust)' }}>{t('skipped')}</span>
                        </div>
                      )
                    }
                    return (
                      <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="section-label" style={{ minWidth: '40px' }}>{t('setIndex', { setNumber: si + 1 })}</span>
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
                            {(() => {
                              // Match plan by canonicalName to handle swapped exercises
                              const matchedPlan = plan.find(p => p.exercise.canonicalName === ex.canonicalName) ?? plan[exIdx]
                              return matchedPlan?.exercise.weightUnit === 'pins' ? common('pins') : common('lbs')
                            })()}
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
                          <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', marginLeft: '3px' }}>{common('reps')}</span>
                        </button>
                        {/* RIR — read-only display here; captured live in ActiveSessionScreen */}
                        {set.rir != null && (
                          <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                            RIR {set.rir}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Session RPE — optional, single tap */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <p className="section-label" style={{ margin: '0 0 4px 0' }}>{t('sessionRpeHeading')}</p>
        <p className="font-mono" style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
          {t('sessionRpeOptional')}
        </p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {RPE_CHOICES.map(choice => {
            const isSelected = sessionRpe === choice
            return (
              <button
                key={choice}
                onClick={() => onSessionRpeChange(isSelected ? null : choice)}
                style={{
                  minWidth: '32px',
                  minHeight: '36px',
                  padding: '0 6px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                  color: isSelected ? 'var(--on-accent)' : 'var(--text-mid)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '0.72rem',
                  fontWeight: isSelected ? 700 : 400,
                }}
              >
                {choice}
              </button>
            )
          })}
        </div>
      </div>

      {/* Session swaps — make default? */}
      {sessionSwaps.length > 0 && onSetDefault && (
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span className="section-label">{t('sessionSwapsHeading')}</span>
          {sessionSwaps.map(swap => {
            const done = defaultsDone.has(swap.oldName)
            const isPending = pendingDefault?.oldName === swap.oldName
            return (
              <div key={swap.oldName}>
                {isPending ? (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--accent-border)', borderRadius: '2px', padding: '10px 12px' }}>
                    <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-mid)', marginBottom: '8px', lineHeight: 1.5 }}>
                      {t('replaceWith', { oldName: swap.oldName, newName: swap.newName })}
                      <br />
                      <span style={{ color: 'var(--text-secondary)' }}>{t('replacePermanentlyBody', { newName: swap.newName })}</span>
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => confirmSetDefault(swap)}
                        disabled={settingDefault}
                        style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: '2px', color: 'var(--on-accent)', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.08em', padding: '7px', cursor: 'pointer', opacity: settingDefault ? 0.6 : 1 }}
                      >
                        {settingDefault ? common('saving') : common('confirm')}
                      </button>
                      <button
                        onClick={() => setPendingDefault(null)}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.08em', padding: '7px 12px', cursor: 'pointer' }}
                      >
                        {t('skip')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="font-mono" style={{ fontSize: '0.6rem', color: done ? 'var(--text-secondary)' : 'var(--text-mid)', flex: 1, textDecoration: done ? 'line-through' : 'none' }}>
                      {swap.oldName} → {swap.newName}
                    </span>
                    {done ? (
                      <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', letterSpacing: '0.06em' }}>{t('saved')}</span>
                    ) : (
                      <button
                        className="swap-badge"
                        onClick={() => setPendingDefault(swap)}
                        style={{ fontSize: '0.55rem' }}
                      >
                        {t('setDefault')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Save CTA */}
      <div className="safe-bottom px-5" style={{ paddingTop: '14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {saveError && (
          <p style={{ color: 'var(--rust)', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', margin: '0 0 10px 0', textAlign: 'center' }}>
            {t('saveFailed')}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
          style={{ opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? t('saving') : saveError ? t('retrySave') : t('saveSession')}
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
          label={`${t('setIndex', { setNumber: editTarget.setIdx + 1 })} — ${editTarget.field === 'weight' ? common('lbs') : common('reps')}`}
          maxValue={editTarget.field === 'weight' ? 999 : 99}
          allowDecimal={editTarget.field === 'weight'}
        />
      )}
    </div>
  )
}
