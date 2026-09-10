import { createSupabaseBrowserClient } from './supabase'
import { convertAbstractUnitsToMass, type AbstractScaleCalibration, type MassUnit } from './weightConversion'

/**
 * lib/equipmentInstances.ts
 *
 * Foundation slice (2026-09-09): CRUD surface for `equipment_instances` — an
 * optional user-defined gym/machine tag ("Gold's Gym — lat pulldown #3")
 * that a set or routine-exercise can reference, with an optional per-
 * instance calibration for abstract-scale (pin-stack) machines. See
 * supabase/migrations/20260909000000_equipment_model.sql. Written fresh
 * against current conventions (matches lib/customExercises.ts's
 * row-mapping/CRUD shape) — reference-only, not ported verbatim from
 * .worktrees/redesign-phase1-foundation's lib/equipmentInstances.ts (see
 * docs/redesign-branch-reconciliation.md).
 *
 * No UI currently calls these — surfacing an instance picker/calibration
 * editor in ActiveSessionScreen/ExercisePickerSheet is explicitly deferred
 * (screen integration is a separate, later pass). This file exists so that
 * future UI work has a ready, tested data layer to call into rather than
 * re-deriving the Supabase queries from scratch.
 *
 * NOTE: `equipment_instances` is additive schema that may not be applied in
 * every environment yet, and (per the migration's own header) an
 * unreconciled leftover copy of this table may already exist live in some
 * environments from prior exploratory work. Unlike lib/exerciseLibrary.ts /
 * lib/supabase.queries.ts (which retry defensively because they run on
 * every session), these functions are not on any live call path yet, so
 * they assume the migration's shape exists — safe because nothing invokes
 * them until a future UI task wires them up, by which point the migration
 * will have been applied and verified.
 */

export interface EquipmentInstance {
  id: string
  userId: string
  name: string
  /** Per-instance abstract-scale calibration, or null when uncalibrated. */
  calibration: AbstractScaleCalibration | null
  createdAt: string
}

interface DbRow {
  id: string
  user_id: string
  name: string
  weight_per_unit: number | null
  weight_per_unit_mass_unit: MassUnit | null
  created_at: string
}

const SELECT_COLS = 'id, user_id, name, weight_per_unit, weight_per_unit_mass_unit, created_at'

export function rowToInstance(row: DbRow): EquipmentInstance {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    calibration:
      row.weight_per_unit != null && row.weight_per_unit_mass_unit != null
        ? { weightPerUnit: row.weight_per_unit, weightPerUnitMassUnit: row.weight_per_unit_mass_unit }
        : null,
    createdAt: row.created_at,
  }
}

/**
 * Resolves a raw abstract-scale reading (a pin/level count) to a real mass
 * for one specific instance — a thin, instance-aware wrapper over
 * lib/weightConversion.ts's convertAbstractUnitsToMass. Returns null when
 * the instance has no calibration on file (the common case today).
 */
export function resolveInstanceMass(
  instance: EquipmentInstance,
  units: number,
  targetUnit: MassUnit
): number | null {
  return convertAbstractUnitsToMass(units, instance.calibration, targetUnit)
}

export async function getEquipmentInstances(userId: string): Promise<EquipmentInstance[]> {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('equipment_instances')
    .select(SELECT_COLS)
    .eq('user_id', userId)
    .order('name', { ascending: true })
  if (error || !data) return []
  return (data as unknown as DbRow[]).map(rowToInstance)
}

export class EquipmentInstanceNameTakenError extends Error {
  constructor(public readonly name: string) {
    super(`Equipment instance "${name}" already exists`)
    this.name = 'EquipmentInstanceNameTakenError'
  }
}

export async function createEquipmentInstance(
  userId: string,
  name: string,
  calibration: AbstractScaleCalibration | null = null
): Promise<EquipmentInstance> {
  const supabase = createSupabaseBrowserClient()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('createEquipmentInstance: name is required')

  const { data: existing } = await supabase
    .from('equipment_instances')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', trimmed)
    .limit(1)
  if (existing && existing.length > 0) {
    throw new EquipmentInstanceNameTakenError(trimmed)
  }

  const { data, error } = await supabase
    .from('equipment_instances')
    .insert({
      user_id: userId,
      name: trimmed,
      weight_per_unit: calibration?.weightPerUnit ?? null,
      weight_per_unit_mass_unit: calibration?.weightPerUnitMassUnit ?? null,
    })
    .select(SELECT_COLS)
    .single()
  if (error || !data) throw error ?? new Error('Failed to create equipment instance')
  return rowToInstance(data as unknown as DbRow)
}

/**
 * Sets or clears an instance's calibration (pass null to clear). Separate
 * from create so an instance can be calibrated after the fact — e.g. the
 * lifter names the machine first and only later notices a fixed weight
 * plate telling them what one pin actually weighs.
 */
export async function updateEquipmentInstanceCalibration(
  id: string,
  calibration: AbstractScaleCalibration | null
): Promise<void> {
  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase
    .from('equipment_instances')
    .update({
      weight_per_unit: calibration?.weightPerUnit ?? null,
      weight_per_unit_mass_unit: calibration?.weightPerUnitMassUnit ?? null,
    })
    .eq('id', id)
  if (error) throw error
}

/**
 * Maps a createEquipmentInstance failure to a user-facing inline message —
 * kept as a pure function so "which message for which error" is testable
 * without a component-rendering harness (this repo has none).
 */
export function resolveInstanceCreateErrorMessage(err: unknown, name: string): string {
  if (err instanceof EquipmentInstanceNameTakenError) {
    return `"${name}" already exists — pick it from the list above instead.`
  }
  return 'Could not add — check your connection and try again.'
}

export async function deleteEquipmentInstance(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.from('equipment_instances').delete().eq('id', id)
  if (error) throw error
}
