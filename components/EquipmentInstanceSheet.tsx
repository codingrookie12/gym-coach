'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  EquipmentInstance,
  createEquipmentInstance,
  resolveInstanceCreateErrorMessage,
} from '@/lib/equipmentInstances'
import type { MassUnit } from '@/lib/weightConversion'

/**
 * components/EquipmentInstanceSheet — equipment-type/unit-conversion
 * integration pass (2026-09-09). Lets the user tag which specific
 * abstract-scale machine ("Gold's Gym — leg press #2") they're using for the
 * current exercise, and first-time-create one with an optional calibration
 * (see lib/equipmentInstances.ts / lib/weightConversion.ts's
 * AbstractScaleCalibration). Follows the same backdrop+bottom-sheet shell
 * and CRUD-form conventions as components/ExercisePickerSheet.tsx and
 * components/CustomExerciseSheet.tsx rather than inventing a new pattern.
 *
 * Session-scoped only: selecting an instance here updates
 * ActiveSessionScreen's local `instanceOverrides` state (mirrors the
 * existing lbs/kg `unitOverrides` pattern) for THIS session — it does not
 * write a routine-level default to `user_routine_exercises.equipment_
 * instance_id`. That's a deliberate scope cut: this app's existing
 * precedent for "make a session choice the routine's default" (exercise
 * swap, see PreSaveSummaryScreen's "SESSION SWAPS — MAKE DEFAULT?" step) is
 * a deferred, explicit, end-of-session confirmation — not an immediate
 * mid-session write to `user_routine_exercises`. Wiring an equivalent
 * "make this machine the default?" step into PreSaveSummaryScreen is real,
 * separate follow-up work, intentionally left out of this pass rather than
 * bolted on unreviewed to a screen that also carries its own GYM-94/Undo
 * write-provenance rules.
 */

interface EquipmentInstanceSheetProps {
  userId: string
  exerciseName: string
  currentInstanceId: string | null
  /** Owned by the caller (ActiveSessionScreen fetches once via
   *  lib/equipmentInstances.ts's getEquipmentInstances) so the same list can
   *  also back a calibration hint elsewhere in the screen without a second
   *  network round trip. */
  instances: EquipmentInstance[]
  loading: boolean
  onSelect: (instanceId: string | null) => void
  /** Fired after a successful create so the caller's list stays in sync. */
  onCreated: (instance: EquipmentInstance) => void
  onClose: () => void
}

export default function EquipmentInstanceSheet({
  userId,
  exerciseName,
  currentInstanceId,
  instances,
  loading,
  onSelect,
  onCreated,
  onClose,
}: EquipmentInstanceSheetProps) {
  const t = useTranslations('equipmentInstance')
  const common = useTranslations('common')

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [knowsCalibration, setKnowsCalibration] = useState(false)
  const [weightPerUnit, setWeightPerUnit] = useState('')
  const [massUnit, setMassUnit] = useState<MassUnit>('lbs')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    setError(null)
    const calibration =
      knowsCalibration && weightPerUnit.trim() && Number(weightPerUnit) > 0
        ? { weightPerUnit: Number(weightPerUnit), weightPerUnitMassUnit: massUnit }
        : null
    try {
      const created = await createEquipmentInstance(userId, trimmed, calibration)
      onCreated(created)
      onSelect(created.id)
      onClose()
    } catch (e) {
      setError(resolveInstanceCreateErrorMessage(e, trimmed))
      setSaving(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        borderRadius: '8px 8px 0 0',
        zIndex: 50,
        padding: '0 20px 32px',
        maxHeight: '85dvh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-2)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 14px', flexShrink: 0 }}>
          <div>
            <p className="section-label" style={{ margin: '0 0 2px 0' }}>{t('title')}</p>
            <h3 className="font-display" style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0, letterSpacing: '0.04em' }}>
              {exerciseName}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontSize: '1.1rem', padding: '4px', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div className="scroll-area" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '12px' }}>
          {/* Untagged / "no specific machine" — always available, matches
             existing default behavior for a user who never opens this sheet. */}
          <button
            onClick={() => { onSelect(null); onClose() }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px',
              background: currentInstanceId === null ? 'var(--accent-dim)' : 'var(--surface-2)',
              border: `1px solid ${currentInstanceId === null ? 'var(--accent-border)' : 'var(--border)'}`,
              borderRadius: '2px',
              color: currentInstanceId === null ? 'var(--accent)' : 'var(--text-mid)',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.75rem',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {t('noSpecificMachine')}
            {currentInstanceId === null && <span>✓</span>}
          </button>

          {loading ? (
            <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', padding: '10px 2px' }}>
              {common('loading')}
            </p>
          ) : (
            instances.map(inst => (
              <button
                key={inst.id}
                onClick={() => { onSelect(inst.id); onClose() }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: currentInstanceId === inst.id ? 'var(--accent-dim)' : 'var(--surface)',
                  border: `1px solid ${currentInstanceId === inst.id ? 'var(--accent-border)' : 'var(--border)'}`,
                  borderRadius: '2px',
                  color: currentInstanceId === inst.id ? 'var(--accent)' : 'var(--text-primary)',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '0.75rem',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>
                  {inst.name}
                  {inst.calibration && (
                    <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontSize: '0.65rem' }}>
                      {t('calibrationHint', { weight: inst.calibration.weightPerUnit, unit: common(inst.calibration.weightPerUnitMassUnit) })}
                    </span>
                  )}
                </span>
                {currentInstanceId === inst.id && <span>✓</span>}
              </button>
            ))
          )}

          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '11px 14px', marginTop: '4px',
                background: 'none', border: '1px dashed var(--border-2)', borderRadius: '2px',
                color: 'var(--text-secondary)', cursor: 'pointer',
                fontFamily: 'Bebas Neue, sans-serif', fontSize: '0.85rem', letterSpacing: '0.08em',
              }}
            >
              {t('addMachine')}
            </button>
          ) : (
            <div style={{ marginTop: '6px', padding: '12px', border: '1px solid var(--border)', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('machineNamePlaceholder')}
                autoFocus
                className="input-field"
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: 'var(--text-mid)' }}>
                <input type="checkbox" checked={knowsCalibration} onChange={e => setKnowsCalibration(e.target.checked)} />
                {t('knowsCalibrationLabel')}
              </label>
              {knowsCalibration && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={weightPerUnit}
                    onChange={e => setWeightPerUnit(e.target.value)}
                    placeholder={t('weightPerUnitPlaceholder')}
                    className="input-field"
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={() => setMassUnit(u => (u === 'kg' ? 'lbs' : 'kg'))}
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.06em', padding: '8px 10px', cursor: 'pointer', flexShrink: 0 }}
                  >
                    {common(massUnit)}
                  </button>
                </div>
              )}
              {error && (
                <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--rust)', margin: 0 }}>{error}</p>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { setShowCreate(false); setError(null) }}
                  style={{ flex: 1, background: 'none', border: '1px solid var(--border-2)', borderRadius: '2px', color: 'var(--text-mid)', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.08em', padding: '10px', cursor: 'pointer' }}
                >
                  {common('cancelCaps')}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!name.trim() || saving}
                  style={{
                    flex: 2,
                    background: name.trim() && !saving ? 'var(--accent)' : 'var(--surface-2)',
                    border: `1px solid ${name.trim() && !saving ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '2px',
                    color: name.trim() && !saving ? 'var(--on-accent)' : 'var(--text-secondary)',
                    fontFamily: 'Bebas Neue, sans-serif', fontSize: '0.95rem', letterSpacing: '0.1em', padding: '10px',
                    cursor: name.trim() && !saving ? 'pointer' : 'not-allowed',
                  }}
                >
                  {saving ? common('saving') : t('create')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
