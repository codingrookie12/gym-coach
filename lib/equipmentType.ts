/**
 * lib/equipmentType.ts
 *
 * Foundation slice (2026-09-09): classifies exercises/equipment into two
 * weight-tracking families instead of the previous mix of `equipment` tag +
 * `weight_unit` + increment ladder + free-text `weight_convention` note.
 * Written fresh against current conventions — reference-only, not ported
 * verbatim from .worktrees/redesign-phase1-foundation's lib/equipmentType.ts
 * (see docs/redesign-branch-reconciliation.md). The precedence rules and
 * instance-matching/override-selection semantics below reproduce that
 * branch's behavior deliberately: they were exercised against real
 * cross-gym-comparison bugs there rather than rediscovered from scratch.
 *
 * - **mass-based**: free-weight, plate-loaded, cable-stack, most machines —
 *   the logged value is a real weight (lbs/kg), freely convertible via
 *   lib/weightConversion.ts.
 * - **abstract-scale**: pin-stack level, band tension — the logged value is
 *   a machine-specific number, NOT a real weight, and must never be run
 *   through the lbs/kg conversion formula directly (a specific equipment
 *   instance MAY carry its own calibration — lib/equipmentInstances.ts —
 *   that converts its own readings to mass; that is per-instance, never a
 *   global rule).
 */

export type EquipmentType = 'mass-based' | 'abstract-scale'

/**
 * Descriptive equipment "kind" — richer vocabulary than the binary
 * EquipmentType family that actually gates conversion behavior. Every kind
 * maps deterministically onto exactly one family via `familyForKind`, so
 * this exists purely to give a future instance-naming/picker UI real
 * categories to offer (e.g. distinguishing a pin-stack machine from a band
 * even though both are 'abstract-scale') without multiplying the number of
 * states the actual conversion/comparison logic has to reason about.
 */
export type EquipmentKind =
  | 'barbell'
  | 'dumbbell'
  | 'plate-loaded-machine'
  | 'cable-stack'
  | 'pin-stack-machine'
  | 'band'
  | 'bodyweight'
  | 'other'

const ABSTRACT_SCALE_KINDS: ReadonlySet<EquipmentKind> = new Set<EquipmentKind>(['pin-stack-machine', 'band'])

/** Maps a descriptive equipment kind onto its behavior-relevant family. */
export function familyForKind(kind: EquipmentKind): EquipmentType {
  return ABSTRACT_SCALE_KINDS.has(kind) ? 'abstract-scale' : 'mass-based'
}

/**
 * Resolves an exercise's equipment type.
 *
 * Precedence:
 * 1. An explicit `equipmentType` (from `exercises.equipment_type` once
 *    backfilled, or an explicit override) always wins.
 * 2. Falls back to the pre-existing `weightUnit === 'pins'` signal already
 *    used by lib/routines.ts / lib/coaching for abstract-scale exercises
 *    (Seated Leg Curl et al.) — the routine-level convention that predates
 *    this column.
 * 3. Falls back to the catalog's free-text `equipment` tag — 'Bands' is the
 *    one existing tag with no real-weight meaning.
 * 4. Defaults to 'mass-based'.
 *
 * This layered fallback means every exercise that hasn't been explicitly
 * classified yet keeps behaving exactly as it did before this column
 * existed — "untagged = same as before" — while exercises that do get an
 * explicit classification take precedence.
 */
export function resolveEquipmentType(input: {
  equipmentType?: EquipmentType | null
  weightUnit?: 'lbs' | 'kg' | 'pins' | null
  equipment?: string | null
}): EquipmentType {
  if (input.equipmentType) return input.equipmentType
  if (input.weightUnit === 'pins') return 'abstract-scale'
  if (input.equipment === 'Bands') return 'abstract-scale'
  return 'mass-based'
}

/**
 * Compares two equipment-instance tags for "same machine" purposes.
 *
 * `null`/`undefined` (untagged) is treated as equal to any other untagged
 * value — untagged entries are assumed to be the same default machine as
 * before this model existed. Two different real tags never match, and a
 * tagged value never matches an untagged one — that's the honest
 * "different gym, not comparable" signal this model exists to surface.
 */
export function matchesInstance(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return (a ?? null) === (b ?? null)
}

/**
 * Picks the right cached "last known weight" override out of however many
 * per-instance rows a user has for one exercise — mirrors the
 * historical-session comparison filter's semantics EXACTLY rather than
 * reinventing them:
 *
 * - abstract-scale (pin-stack/band): a row only counts when
 *   `matchesInstance(row.equipmentInstanceId, currentInstanceId)` is true —
 *   the identical strict gate the session-history filter uses, with NO
 *   substitution tier. A tagged context ('gym-a') with only an untagged row
 *   on file is a miss, full stop — `matchesInstance('gym-a', null)` is
 *   `false`, so that row is not "the same default machine" once the
 *   exercise has started being tagged; serving it anyway would be exactly
 *   the "wrong machine's cached number" bug this model exists to prevent.
 *   An untagged context only matches an untagged row — already covered by
 *   the `matchesInstance` check below, no separate branch needed.
 * - mass-based (real weight) or 'unknown' (type not resolvable at the call
 *   site — e.g. an exercise not yet matched to a catalog row): a real
 *   weight is the same weight at any gym, so instance never gates the
 *   answer. Prefer the untagged/default row for stability when one exists,
 *   otherwise take whichever row is available.
 */
export function pickWeightOverride(
  entries: { weight: number; equipmentInstanceId: string | null }[],
  currentInstanceId: string | null | undefined,
  equipmentType: EquipmentType | 'unknown' = 'unknown'
): number | null {
  if (!entries.length) return null

  const exact = entries.find(e => matchesInstance(e.equipmentInstanceId, currentInstanceId))
  if (exact) return exact.weight

  if (equipmentType === 'abstract-scale') {
    // Strict gate, no fallback tier — matches the session-history filter
    // 1:1. Anything short of an exact matchesInstance hit (already checked
    // above) is not this machine's cached number.
    return null
  }

  // 'mass-based' or 'unknown' — instance-agnostic.
  const untagged = entries.find(e => e.equipmentInstanceId === null)
  return (untagged ?? entries[0]).weight
}
