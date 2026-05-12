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
  const { data: inserted, error: insertError } = await supabase
    .from('user_routine_exercises')
    .insert({
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
    })
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

export async function reorderExercisesInSplit(
  supabase: Supabase,
  userId: string,
  splitId: string,
  orderedIds: string[],
  currentRows: Array<{ id: string; sort_order: number }>
): Promise<void> {
  const currentById = new Map(currentRows.map(r => [r.id, r.sort_order]))
  const updates: Array<Promise<void>> = []
  orderedIds.forEach((id, newIndex) => {
    if (currentById.get(id) === newIndex) return
    updates.push(
      Promise.resolve(
        supabase
          .from('user_routine_exercises')
          .update({ sort_order: newIndex })
          .eq('id', id)
          .eq('user_id', userId)
          .eq('user_program_split_id', splitId)
      ).then(({ error }) => {
        if (error) throw error
      })
    )
  })
  await Promise.all(updates)
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
