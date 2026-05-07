import { createSupabaseServerClient } from './supabase.server'
import type { SessionRecord } from './notion'

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

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
  userProgramSplitId: string,
  startedAt?: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('user_program_split_id', userProgramSplitId)
    .maybeSingle()
  if (existing) return existing.id as string

  const { data: inserted, error } = await supabase
    .from('workouts')
    .insert({
      user_id: userId,
      date,
      user_program_split_id: userProgramSplitId,
      started_at: startedAt ?? new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error?.code === '23505') {
    const { data: retry } = await supabase
      .from('workouts')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('user_program_split_id', userProgramSplitId)
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

export async function fetchLastSessionsFromSupabase(
  supabase: Supabase,
  userProgramSplitId: string,
  maxSessions: number = 5
): Promise<SessionRecord[]> {
  const { data: workoutRows } = await supabase
    .from('workouts')
    .select('id, date')
    .eq('user_program_split_id', userProgramSplitId)
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

export async function fetchWeightOverrides(supabase: Supabase, userId: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('exercise_weight_override')
    .select('override_weight, exercises(name)')
    .eq('user_id', userId)
  if (!data) return {}
  const result: Record<string, number> = {}
  for (const row of data) {
    const name = (row.exercises as any)?.name as string | undefined
    if (name) result[name] = Number(row.override_weight)
  }
  return result
}

export async function retryFailedSyncs(
  supabase: Supabase,
  userId: string,
  pending: Array<{ id: string; payload: any; retry_count: number }>
): Promise<void> {
  for (const row of pending) {
    const entries = row.payload?.entries
    if (!entries?.length) continue
    try {
      const res = await fetch('/api/session/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })
      const data = await res.json()
      if (data.success && !data.skipped?.length) {
        await supabase.from('failed_syncs').update({ resolved_at: new Date().toISOString() }).eq('id', row.id).eq('user_id', userId)
      } else {
        await supabase.from('failed_syncs').update({ retry_count: row.retry_count + 1 }).eq('id', row.id).eq('user_id', userId)
      }
    } catch {
      await supabase.from('failed_syncs').update({ retry_count: row.retry_count + 1 }).eq('id', row.id).eq('user_id', userId)
    }
  }
}

export async function permanentlySwapExercise(
  supabase: Supabase,
  userId: string,
  splitId: string,
  oldExerciseName: string,
  newExerciseName: string
): Promise<void> {
  const { error } = await supabase
    .from('user_routine_exercises')
    .update({ exercise_name: newExerciseName, notion_name: newExerciseName })
    .eq('user_id', userId)
    .eq('user_program_split_id', splitId)
    .eq('exercise_name', oldExerciseName)
  if (error) throw error
}

