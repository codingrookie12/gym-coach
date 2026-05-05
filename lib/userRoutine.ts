import { createSupabaseBrowserClient } from './supabase'
import type { Exercise } from './routines'
import { getAvailableWeightsForEquipment } from './routines'

type Supabase = ReturnType<typeof createSupabaseBrowserClient>

export interface RoutineExerciseRow {
  id: string
  exercise_name: string
  notion_name: string
  sets: number
  rep_range_min: number
  rep_range_max: number
  backup_name: string | null
  weight_unit: 'lbs' | 'pins'
  weight_convention: string | null
  sort_order: number
  equipment: string | null
}

async function resolveModeId(supabase: Supabase, splitName: string): Promise<string> {
  const { data, error } = await supabase
    .from('training_modes')
    .select('id')
    .eq('name', splitName)
    .single()
  if (error || !data) throw new Error(`training_mode not found for split: ${splitName}`)
  return data.id as string
}

export async function getUserRoutineForSplit(
  supabase: Supabase,
  userId: string,
  splitName: string
): Promise<RoutineExerciseRow[]> {
  const modeId = await resolveModeId(supabase, splitName)
  const { data, error } = await supabase
    .from('user_routine_exercises')
    .select('id, exercise_name, notion_name, sets, rep_range_min, rep_range_max, backup_name, weight_unit, weight_convention, sort_order, equipment')
    .eq('user_id', userId)
    .eq('training_mode_id', modeId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as RoutineExerciseRow[]
}

const ROW_COLUMNS = 'id, exercise_name, notion_name, sets, rep_range_min, rep_range_max, backup_name, weight_unit, weight_convention, sort_order, equipment'

export async function addExerciseToRoutine(
  supabase: Supabase,
  userId: string,
  splitName: string,
  exercise: { name: string; equipment?: string; weightUnit?: 'lbs' | 'pins' },
  sortOrder: number
): Promise<RoutineExerciseRow> {
  const modeId = await resolveModeId(supabase, splitName)

  const insertPayload = {
    user_id: userId,
    training_mode_id: modeId,
    exercise_name: exercise.name,
    notion_name: exercise.name,
    sets: 3,
    rep_range_min: 8,
    rep_range_max: 12,
    equipment: exercise.equipment ?? null,
    weight_unit: exercise.weightUnit ?? 'lbs',
    sort_order: sortOrder,
  }

  // Try plain INSERT first — most common path, returns the inserted row.
  const { data: inserted, error: insertError } = await supabase
    .from('user_routine_exercises')
    .insert(insertPayload)
    .select(ROW_COLUMNS)
    .single()

  if (!insertError && inserted) {
    return inserted as RoutineExerciseRow
  }

  // 23505 = unique_violation. Row already exists — UPDATE in place to match
  // the requested state (sort_order, equipment, weight_unit).
  if (insertError?.code === '23505') {
    const { data: updated, error: updateError } = await supabase
      .from('user_routine_exercises')
      .update({
        sort_order: sortOrder,
        equipment: exercise.equipment ?? null,
        weight_unit: exercise.weightUnit ?? 'lbs',
      })
      .eq('user_id', userId)
      .eq('training_mode_id', modeId)
      .eq('exercise_name', exercise.name)
      .select(ROW_COLUMNS)
      .single()

    if (updateError) throw updateError
    if (!updated) throw new Error(`addExerciseToRoutine: update returned no row for "${exercise.name}"`)
    return updated as RoutineExerciseRow
  }

  if (insertError) throw insertError
  throw new Error(`addExerciseToRoutine: insert returned no row for "${exercise.name}"`)
}

export async function removeExerciseFromRoutine(
  supabase: Supabase,
  userId: string,
  splitName: string,
  exerciseName: string
): Promise<void> {
  const modeId = await resolveModeId(supabase, splitName)
  const { error } = await supabase
    .from('user_routine_exercises')
    .delete()
    .eq('user_id', userId)
    .eq('training_mode_id', modeId)
    .eq('exercise_name', exerciseName)
  if (error) throw error
  // Idempotent — zero rows deleted is a successful no-op (e.g. caller already removed it).
}

// Maps DB rows to the Exercise interface used by the coaching engine.
// Returns [] when no user routine exists — caller falls back to static program routine.
export async function getUserRoutineAsExercises(
  supabase: Supabase,
  userId: string,
  splitName: string
): Promise<Exercise[]> {
  try {
    const rows = await getUserRoutineForSplit(supabase, userId, splitName)
    if (!rows.length) return []
    return rows.map(row => ({
      name: row.exercise_name,
      notionName: row.notion_name,
      sets: row.sets,
      repRange: [row.rep_range_min, row.rep_range_max] as [number, number],
      backup: row.backup_name,
      split: splitName,
      weightUnit: row.weight_unit,
      weightConvention: row.weight_convention ?? undefined,
      equipment: row.equipment ?? undefined,
      availableWeights: row.equipment ? getAvailableWeightsForEquipment(row.equipment) : [],
    }))
  } catch {
    return []
  }
}
