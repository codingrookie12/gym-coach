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
