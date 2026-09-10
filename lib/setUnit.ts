/**
 * lib/setUnit.ts
 *
 * Foundation slice (2026-09-09): resolves which unit should be persisted to
 * `sets.unit` for a logged set, given the in-session unit, the routine's
 * static default, and the exercise's resolved equipment type. Written
 * fresh against current conventions — reference-only, not ported verbatim
 * from .worktrees/redesign-phase1-foundation's lib/setUnit.ts (see
 * docs/redesign-branch-reconciliation.md).
 *
 * Not wired into any screen or write path yet — that integration
 * (ActiveSessionScreen.tsx / app/api/session/write/route.ts) is a separate,
 * later pass. This exists now, ahead of that wiring, because the branch
 * this is based on documented a real unit-persistence bug worth designing
 * around from the start rather than rediscovering: a toggle that changed
 * what was DISPLAYED without changing what got WRITTEN (users would see
 * "PINS" on screen but the set silently saved as "Lbs"). The fix there —
 * making equipment type authoritative over whatever legacy unit string
 * happens to be stored — is reproduced here as the contract from day one:
 * `equipmentType` always wins for abstract-scale, regardless of what the
 * log/routine's stored unit string says.
 */

import type { EquipmentType } from './equipmentType'

export type WeightUnit = 'lbs' | 'kg' | 'pins'

/**
 * @param exerciseLogUnit    The in-session resolved unit for this exercise
 *   — kept in sync by the user's toggle. Authoritative for mass-based
 *   exercises once a session has started.
 * @param routineDefaultUnit The routine's static default (`weight_unit` on
 *   `user_routine_exercises`) — used only as a fallback for the case
 *   `exerciseLogUnit` was never set.
 * @param equipmentType      Resolved via `resolveEquipmentType`
 *   (lib/equipmentType.ts). Abstract-scale always wins and persists 'Pins'
 *   — see file header.
 */
export function resolvePersistedUnit(
  exerciseLogUnit: WeightUnit | undefined | null,
  routineDefaultUnit: WeightUnit | undefined | null,
  equipmentType: EquipmentType
): 'Lbs' | 'Kg' | 'Pins' {
  if (equipmentType === 'abstract-scale') return 'Pins'
  const resolved = exerciseLogUnit ?? routineDefaultUnit ?? 'lbs'
  return resolved === 'kg' ? 'Kg' : 'Lbs'
}

/**
 * Maps a (possibly capitalized/DB-form) weight unit to the `common.*` i18n
 * key that labels it on screen — `common.lbs` / `common.kg` / `common.pins`.
 * Pulled out as one shared function so the several screens that render
 * `unit === 'pins' ? common('pins') : common('lbs')` (a binary check that
 * silently mislabels 'kg' as 'lbs') don't each need their own 3-way switch —
 * see components/screens/ActiveSessionScreen.tsx and siblings for callers.
 * Unrecognized/undefined input defaults to 'lbs', matching every existing
 * call site's prior fallback behavior.
 */
export function weightUnitLabelKey(
  unit: WeightUnit | 'Lbs' | 'Kg' | 'Pins' | undefined | null
): 'lbs' | 'kg' | 'pins' {
  switch (unit) {
    case 'kg':
    case 'Kg':
      return 'kg'
    case 'pins':
    case 'Pins':
      return 'pins'
    default:
      return 'lbs'
  }
}

/** Toggles between the two mass-based display units. Never returns 'pins' —
 *  abstract-scale exercises don't offer this toggle (see ActiveSessionScreen). */
export function nextMassUnit(unit: 'lbs' | 'kg'): 'lbs' | 'kg' {
  return unit === 'kg' ? 'lbs' : 'kg'
}

/**
 * Resolves which mass unit ActiveSessionScreen should currently display/
 * toggle for an exercise, in priority order:
 *   1. `sessionOverride` — this render's in-memory toggle state
 *      (`massUnitOverrides[currentExIdx]`), if the user has touched the
 *      toggle at all THIS mount.
 *   2. `logUnit` — the exercise log's own already-resolved unit
 *      (lib/store.ts's ExerciseLog.unit), set by a PRIOR toggle. Critical
 *      for session resume: a fresh component mount resets `sessionOverride`
 *      to empty, but a resumed log's sets may already hold real kg values
 *      from before the resume — falling through to the routine's static
 *      default here would relabel those already-converted numbers as "Lbs"
 *      (the exact mismatch lib/weightConversion.ts's header warns about).
 *   3. `routineDefaultUnit` — the routine's static default, exactly
 *      reproducing today's behavior for any exercise nobody has touched.
 */
export function resolveActiveMassUnit(
  sessionOverride: 'lbs' | 'kg' | undefined,
  logUnit: 'Lbs' | 'Kg' | 'Pins' | undefined | null,
  routineDefaultUnit: WeightUnit | undefined | null
): 'lbs' | 'kg' {
  if (sessionOverride) return sessionOverride
  if (logUnit === 'Kg') return 'kg'
  if (logUnit === 'Lbs') return 'lbs'
  return routineDefaultUnit === 'kg' ? 'kg' : 'lbs'
}
