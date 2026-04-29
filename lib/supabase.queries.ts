import { createSupabaseServerClient } from './supabase.server'
import type { Split } from './routines'
import type { SessionRecord } from './notion'

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

export async function getTrainingModeId(supabase: Supabase, split: Split): Promise<string> {
  const { data, error } = await supabase
    .from('training_modes')
    .select('id')
    .eq('name', split)
    .single()
  if (error || !data) throw new Error(`Training mode not found: ${split}`)
  return data.id as string
}

export async function getExerciseId(supabase: Supabase, canonicalName: string): Promise<string | null> {
  const { data } = await supabase
    .from('exercises')
    .select('id')
    .eq('name', canonicalName)
    .maybeSingle()
  return (data?.id as string) ?? null
}

export async function getOrCreateWorkout(
  supabase: Supabase,
  userId: string,
  date: string,
  trainingModeId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('training_mode_id', trainingModeId)
    .maybeSingle()
  if (existing) return existing.id as string

  const { data: inserted, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, date, training_mode_id: trainingModeId })
    .select('id')
    .single()

  if (error?.code === '23505') {
    // Race condition: re-fetch the row created by the concurrent request
    const { data: retry } = await supabase
      .from('workouts')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('training_mode_id', trainingModeId)
      .single()
    return retry!.id as string
  }
  if (error) throw error
  return inserted!.id as string
}

export async function upsertWeightOverride(
  supabase: Supabase,
  userId: string,
  exerciseId: string,
  weight: number,
  unit: string
): Promise<void> {
  const { error } = await supabase
    .from('exercise_weight_override')
    .upsert(
      { user_id: userId, exercise_id: exerciseId, override_weight: weight, unit },
      { onConflict: 'user_id,exercise_id' }
    )
  if (error) throw error
}

// Returns last N sessions for a split, keyed by canonical exercise name.
// RLS scopes results to the authenticated user automatically.
export async function fetchLastSessionsFromSupabase(
  supabase: Supabase,
  split: Split,
  maxSessions: number = 5
): Promise<SessionRecord[]> {
  const trainingModeId = await getTrainingModeId(supabase, split)

  const { data: workoutRows } = await supabase
    .from('workouts')
    .select('id, date')
    .eq('training_mode_id', trainingModeId)
    .order('date', { ascending: false })
    .limit(maxSessions)

  if (!workoutRows?.length) return []

  const workoutIds = workoutRows.map(w => w.id as string)

  const { data: setRows } = await supabase
    .from('sets')
    .select('workout_id, set_number, weight, reps, exercises(name)')
    .in('workout_id', workoutIds)
    .order('set_number', { ascending: true })

  if (!setRows?.length) return []

  const workoutDateMap = new Map(workoutRows.map(w => [w.id as string, w.date as string]))

  const dateGroups = new Map<string, typeof setRows>()
  for (const row of setRows) {
    const date = workoutDateMap.get(row.workout_id as string)
    if (!date) continue
    if (!dateGroups.has(date)) dateGroups.set(date, [])
    dateGroups.get(date)!.push(row)
  }

  return Array.from(dateGroups.entries())
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .map(([date, rows]) => {
      const exercises: SessionRecord['exercises'] = {}
      for (const row of rows) {
        const name = (row.exercises as any)?.name as string | undefined
        if (!name) continue
        if (!exercises[name]) exercises[name] = { sets: [] }
        exercises[name].sets.push({
          set: row.set_number as number,
          weight: Number(row.weight),
          reps: row.reps as number,
        })
      }
      return { date, exercises }
    })
}
