import { createSupabaseBrowserClient } from './supabase'

type Supabase = ReturnType<typeof createSupabaseBrowserClient>

export interface RoutineExerciseRow {
  id: string
  exercise_name: string
  canonical_name: string
  sets: number
  rep_range_min: number
  rep_range_max: number
  backup_name: string | null
  weight_unit: 'lbs' | 'pins'
  weight_convention: string | null
  sort_order: number
  equipment: string | null
}

/**
 * GYM-94: Every write to user_routine_exercises must declare its origin.
 * The DB has a CHECK constraint matching this union — keep them in sync.
 */
export type AddedVia = 'template-clone' | 'custom-program-create' | 'manual-add' | 'manual-swap'


export async function getUserRoutineForSplit(
  supabase: Supabase,
  splitId: string
): Promise<RoutineExerciseRow[]> {
  const { data, error } = await supabase
    .from('user_routine_exercises')
    .select('id, exercise_name, canonical_name, sets, rep_range_min, rep_range_max, backup_name, weight_unit, weight_convention, sort_order, equipment')
    .eq('user_program_split_id', splitId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as RoutineExerciseRow[]
}

const ROW_COLUMNS = 'id, exercise_name, canonical_name, sets, rep_range_min, rep_range_max, backup_name, weight_unit, weight_convention, sort_order, equipment'

/**
 * Inserts an exercise into a user's routine. Throws on any error — including
 * unique-constraint conflicts. Callers must declare `addedVia` so every row
 * has traceable provenance (GYM-94).
 */
export async function addExerciseToRoutine(
  supabase: Supabase,
  userId: string,
  splitId: string,
  exercise: { name: string; equipment?: string; weightUnit?: 'lbs' | 'pins' },
  sortOrder: number,
  addedVia: AddedVia,
): Promise<RoutineExerciseRow> {
  const { data, error } = await supabase
    .from('user_routine_exercises')
    .insert({
      user_id: userId,
      user_program_split_id: splitId,
      exercise_name: exercise.name,
      canonical_name: exercise.name,
      sets: 3,
      rep_range_min: 8,
      rep_range_max: 12,
      equipment: exercise.equipment ?? null,
      weight_unit: exercise.weightUnit ?? 'lbs',
      sort_order: sortOrder,
      added_via: addedVia,
    })
    .select(ROW_COLUMNS)
    .single()

  if (error) throw error
  if (!data) throw new Error(`addExerciseToRoutine: insert returned no row for "${exercise.name}"`)
  return data as RoutineExerciseRow
}

/**
 * Atomic swap: updates the existing row's exercise + equipment in place,
 * preserving sets/reps/sort_order. Re-stamps `added_via` to 'manual-swap'
 * so the row's provenance reflects its current state (GYM-94).
 */
export async function swapExerciseInRoutine(
  supabase: Supabase,
  userId: string,
  splitId: string,
  oldExerciseName: string,
  newExercise: { name: string; equipment?: string; weightUnit?: 'lbs' | 'pins' },
): Promise<RoutineExerciseRow> {
  const { data, error } = await supabase
    .from('user_routine_exercises')
    .update({
      exercise_name: newExercise.name,
      canonical_name: newExercise.name,
      equipment: newExercise.equipment ?? null,
      weight_unit: newExercise.weightUnit ?? 'lbs',
      added_via: 'manual-swap',
    })
    .eq('user_id', userId)
    .eq('user_program_split_id', splitId)
    .eq('exercise_name', oldExerciseName)
    .select(ROW_COLUMNS)
    .single()
  if (error) throw error
  if (!data) throw new Error(`swapExerciseInRoutine: no row to swap for "${oldExerciseName}"`)
  return data as RoutineExerciseRow
}

export async function removeExerciseFromRoutine(
  supabase: Supabase,
  userId: string,
  splitId: string,
  exerciseName: string
): Promise<void> {
  const { error } = await supabase
    .from('user_routine_exercises')
    .delete()
    .eq('user_id', userId)
    .eq('user_program_split_id', splitId)
    .eq('exercise_name', exerciseName)
  if (error) throw error
}
