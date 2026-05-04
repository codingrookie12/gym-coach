import { createSupabaseServerClient } from './supabase.server'
import type { Split } from './routines'
import type { SessionRecord } from './notion'
import { getProgramById } from './programs'
import { getAllExercisesForProgram } from './routines'

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

export async function getTrainingModeId(supabase: Supabase, split: Split): Promise<string | null> {
  const { data } = await supabase
    .from('training_modes')
    .select('id')
    .eq('name', split)
    .single()
  return data ? (data.id as string) : null
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
  trainingModeId: string,
  startedAt?: string
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
    .insert({ user_id: userId, date, training_mode_id: trainingModeId, started_at: startedAt ?? new Date().toISOString() })
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
  if (!trainingModeId) return []

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

// Seeds the user's routine exercises for a program on first use.
// Idempotent — uses ON CONFLICT DO NOTHING. Safe under concurrent tabs.
export async function getOrSeedRoutine(
  supabase: Supabase,
  userId: string,
  programId: string = 'ppl-default'
): Promise<void> {
  const program = getProgramById(programId)
  if (!program) throw new Error(`Unknown program: ${programId}`)

  // Per-program seeding guard: count existing rows only for this program's splits
  const { data: guardModeRows } = await supabase
    .from('training_modes').select('id').in('name', program.splits)
  if (!guardModeRows?.length) return  // migration not applied yet — safe to bail
  const guardModeIds = guardModeRows.map(r => r.id as string)
  const { count } = await supabase
    .from('user_routine_exercises')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('training_mode_id', guardModeIds)
  if (count && count > 0) return

  const exercises = getAllExercisesForProgram(programId)
  if (!exercises.length) return

  // Fetch training_mode_id for each unique split name
  const splitNames = Array.from(new Set(exercises.map(e => e.split)))
  const { data: modeRows } = await supabase
    .from('training_modes')
    .select('id, name')
    .in('name', splitNames)

  if (!modeRows?.length) return  // migration not applied — degrade gracefully

  const modeMap = new Map(modeRows.map(r => [r.name as string, r.id as string]))

  const rows = exercises.map((ex, i) => {
    const trainingModeId = modeMap.get(ex.split)
    if (!trainingModeId) throw new Error(`No training_mode_id for split: ${ex.split}`)
    return {
      user_id: userId,
      training_mode_id: trainingModeId,
      exercise_name: ex.name,
      notion_name: ex.notionName,
      sets: ex.sets,
      rep_range_min: ex.repRange[0],
      rep_range_max: ex.repRange[1],
      backup_name: ex.backup ?? null,
      weight_unit: ex.weightUnit ?? 'lbs',
      weight_convention: ex.weightConvention ?? null,
      sort_order: i,
    }
  })

  const { error } = await supabase
    .from('user_routine_exercises')
    .upsert(rows, { onConflict: 'user_id,training_mode_id,exercise_name', ignoreDuplicates: true })

  if (error) throw error
}

// Fetches the max logged weight per exercise for a user, keyed by exercise name.
// Used as a cross-program weight fallback in the coaching engine.
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

// Retries entries from failed_syncs. Marks resolved or increments retry_count.
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

// Permanently promotes an alternative exercise to primary in the user's routine.
// The old primary exercise name is removed; the new one takes its slot.
export async function permanentlySwapExercise(
  supabase: Supabase,
  userId: string,
  splitName: string,
  oldExerciseName: string,
  newExerciseName: string
): Promise<void> {
  const { data: modeRow } = await supabase
    .from('training_modes')
    .select('id')
    .eq('name', splitName)
    .single()

  if (!modeRow) throw new Error(`training_mode not found for split: ${splitName}`)

  const { error } = await supabase
    .from('user_routine_exercises')
    .update({ exercise_name: newExerciseName, notion_name: newExerciseName })
    .eq('user_id', userId)
    .eq('training_mode_id', modeRow.id)
    .eq('exercise_name', oldExerciseName)

  if (error) throw error
}
