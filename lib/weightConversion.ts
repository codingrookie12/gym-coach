/**
 * lib/weightConversion.ts
 *
 * Foundation slice (2026-09-09): the single shared lbs<->kg conversion for
 * mass-based equipment (free-weight, plate-loaded, cable-stack, most
 * machines). Written fresh against current conventions — reference-only,
 * not ported verbatim from .worktrees/redesign-phase1-foundation's
 * lib/weightConversion.ts (see docs/redesign-branch-reconciliation.md).
 * The conversion factor, rounding rule, and preset/display helpers below
 * reproduce that branch's math and its documented fix history rather than
 * rediscovering it — most notably a real ~2.2x data-corruption bug the
 * branch found and fixed (tapping a preset weight while toggled to kg wrote
 * the RAW lbs number back with unit: 'kg' instead of converting it first;
 * see 20260822000000_phase1_schema_prep.sql's own comment, which explicitly
 * flags this as a bug to avoid repeating). `convertPresetWeight` below
 * exists specifically so any future caller has the correct, tested
 * conversion path already built rather than an ad hoc one that can regress
 * that bug.
 *
 * Abstract-scale equipment (pin-stack, band tension) has NO universal
 * real-weight meaning — a "pin 5" is machine-specific, not a physical mass.
 * Never call these functions on a raw abstract-scale reading. Callers
 * should gate on `resolveEquipmentType(...) === 'mass-based'` first (see
 * lib/equipmentType.ts) before converting or comparing weights across
 * units. The one exception is `convertAbstractUnitsToMass` below, which
 * converts an abstract-scale reading to mass ONLY via a specific equipment
 * instance's own calibration (lib/equipmentInstances.ts) — never via this
 * file's lbs<->kg formula directly.
 *
 * One constant, one place — every conversion in the app should route
 * through this file rather than re-declaring the factor locally.
 */

/** Exact conversion factor: 1 kg = 2.20462 lbs. */
export const LBS_PER_KG = 2.20462

export function lbsToKg(lbs: number): number {
  return lbs / LBS_PER_KG
}

export function kgToLbs(kg: number): number {
  return kg * LBS_PER_KG
}

export type MassUnit = 'lbs' | 'kg'

/** Converts a mass-based weight between lbs and kg. No-op when from === to. */
export function convertMass(value: number, from: MassUnit, to: MassUnit): number {
  if (from === to) return value
  return from === 'lbs' ? lbsToKg(value) : kgToLbs(value)
}

/**
 * Standard practical increment for a converted mass-based weight, in
 * whichever unit the value is currently in. 2.5 is the smallest full
 * barbell-plate-pair increment used internationally in both lbs and kg (a
 * matched pair of 1.25-unit plates), and matches the finest increment
 * (2.5 lbs) already visible across this app's own historical logged
 * weights.
 */
const STANDARD_MASS_INCREMENT = 2.5

/**
 * Snaps a weight that just came out of a unit conversion to the nearest
 * real, loadable value (2.5-unit increments) instead of the
 * mathematically-precise but unachievable raw division result — e.g. 135
 * lbs converts to 60 kg, not 61.234. A plate-loaded weight only ever exists
 * at these standard steps, so the CONVERTED value itself should be one of
 * them, not merely displayed as if it were.
 *
 * Only ever call this on the OUTPUT of a conversion — never on a value the
 * user typed directly in their already-native unit, which should be
 * preserved exactly as entered.
 */
export function roundMass(value: number): number {
  return Math.round(value / STANDARD_MASS_INCREMENT) * STANDARD_MASS_INCREMENT
}

/**
 * Converts an lbs-denominated preset weight (this app's preset ladders —
 * e.g. lib/routines.ts's `availableWeights` — are always lbs-denominated)
 * to the given display unit, snapped to a real loadable value. Exists so
 * toggling a mass-based exercise's display unit converts BOTH the
 * displayed preset numbers and the value written when one is tapped — the
 * exact bug class documented in this file's header. No-op for 'lbs' (the
 * presets' native unit) via `convertMass`'s own from===to guard.
 */
export function convertPresetWeight(lbsWeight: number, unit: MassUnit): number {
  return roundMass(convertMass(lbsWeight, 'lbs', unit))
}

/**
 * Converts a whole lbs-denominated preset ladder (e.g. lib/routines.ts's
 * `availableWeights`) to a display unit via `convertPresetWeight`, then
 * dedupes — preserving first-seen order.
 *
 * Live-verification finding (Playwright, gym-coach-dev, 2026-09-09): a dense
 * lbs ladder (5lb steps) converted through the 2.5-unit kg rounding grid
 * produces genuine duplicate values — e.g. 25 lbs and 30 lbs both round to
 * 12.5 kg. Left undeduped, that broke components/ui/ChipGrid.tsx (which
 * keys each chip by its value) with a duplicate-key warning, and showed the
 * user two chips reading the same number. Deduping is correct, not lossy:
 * once two source values round to the identical displayed number, they
 * really do offer the same outcome — collapsing them to one chip is the
 * accurate representation. No-op (but still deduped) for 'lbs', matching
 * `convertPresetWeight`'s own no-op-for-lbs behavior.
 */
export function convertPresetLadder(lbsLadder: number[], unit: MassUnit): number[] {
  const seen = new Set<number>()
  const result: number[] = []
  for (const w of lbsLadder) {
    const converted = convertPresetWeight(w, unit)
    if (!seen.has(converted)) {
      seen.add(converted)
      result.push(converted)
    }
  }
  return result
}

/**
 * Formats a weight for on-screen display: 1 decimal max, trailing zero
 * stripped (61.23 -> "61.2", 45.0 -> "45"). Stored/confirmed values keep
 * their full `roundMass` precision — this only affects rendered text, not
 * what gets written to the DB. Raw 2-decimal kg conversions on a big,
 * glanceable set-weight display read as noise, not usable mid-workout.
 */
export function formatWeightDisplay(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/**
 * Per-instance calibration for an abstract-scale machine — e.g. "one pin on
 * THIS leg press = 50 lbs." See lib/equipmentInstances.ts, which owns
 * reading/writing this shape against `equipment_instances.weight_per_unit`
 * / `weight_per_unit_mass_unit`.
 */
export interface AbstractScaleCalibration {
  weightPerUnit: number
  weightPerUnitMassUnit: MassUnit
}

/**
 * Converts an abstract-scale reading (a raw pin/level count) to a real
 * mass, using ONE SPECIFIC equipment instance's own calibration — never a
 * global formula, because an abstract-scale number has no meaning outside
 * the machine it came from (see this file's header). Returns null when no
 * calibration is on file: callers must treat that as "not convertible,"
 * never silently fall back to treating the raw unit count as if it were
 * already a weight.
 */
export function convertAbstractUnitsToMass(
  units: number,
  calibration: AbstractScaleCalibration | null,
  targetUnit: MassUnit
): number | null {
  if (!calibration) return null
  const rawMass = units * calibration.weightPerUnit
  return convertMass(rawMass, calibration.weightPerUnitMassUnit, targetUnit)
}
