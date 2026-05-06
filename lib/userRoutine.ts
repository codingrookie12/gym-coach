import { createSupabaseBrowserClient } from './supabase'

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

async function resolveModeId(supabase: Supabase, splitName: string): Promise<string | null> {
  const { data } = await supabase
    .from('training_modes')
    .select('id')
    .eq('name', splitName)
    .maybeSingle()
  return (data?.id as string) ?? null
}

async function resolveSplitName(supabase: Supabase, splitId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_program_splits')
    .select('name')
    .eq('id', splitId)
    .maybeSingle()
  return (data?.name as string) ?? null
}

export async function getUserRoutineForSplit(
  supabase: Supabase,
  splitId: string
): Promise<RoutineExerciseRow[]> {
  const { data, error } = await supabase
    .from('user_routine_exercises')
    .select('id, exercise_name, notion_name, sets, rep_range_min, rep_range_max, backup_name, weight_unit, weight_convention, sort_order, equipment')
    .eq('user_program_split_id', splitId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as RoutineExerciseRow[]
}

const ROW_COLUMNS = 'id, exercise_name, notion_name, sets, rep_range_min, rep_range_max, backup_name, weight_unit, weight_convention, sort_order, equipment'

export async function addExerciseToRoutine(
  supabase: Supabase,
  userId: string,
  splitId: string,
  exercise: { name: string; equipment?: string; weightUnit?: 'lbs' | 'pins' },
  sortOrder: number
): Promise<RoutineExerciseRow> {
  const splitName = await resolveSplitName(supabase, splitId)
  const legacyModeId = splitName ? await resolveModeId(supabase, splitName) : null

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    user_program_split_id: splitId,
    exercise_name: exercise.name,
    notion_name: exercise.name,
    sets: 3,
    rep_range_min: 8,
    rep_range_max: 12,
    equipment: exercise.equipment ?? null,
    weight_unit: exercise.weightUnit ?? 'lbs',
    sort_order: sortOrder,
  }
  if (legacyModeId) insertPayload.training_mode_id = legacyModeId

  const { data: inserted, error: insertError } = await supabase
    .from('user_routine_exercises')
    .insert(insertPayload)
    .select(ROW_COLUMNS)
    .single()

  if (!insertError && inserted) {
    return inserted as RoutineExerciseRow
  }

  if (insertError?.code === '23505') {
    const { data: updated, error: updateError } = await supabase
      .from('user_routine_exercises')
      .update({
        sort_order: sortOrder,
        equipment: exercise.equipment ?? null,
        weight_unit: exercise.weightUnit ?? 'lbs',
      })
      .eq('user_id', userId)
      .eq('user_program_split_id', splitId)
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
