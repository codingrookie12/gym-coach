/**
 * lib/coaching/data.ts
 *
 * Supabase data-fetching for the new engine — additive, parallel to
 * lib/supabase.queries.ts's existing functions (which stay untouched for the
 * old engine / other screens). The one behavioral difference that matters:
 * every function here keys by `exercise_id` (UUID), never by exercise name,
 * closing GYM-92's root cause at the data layer, not just inside the engine.
 *
 * NOT unit-tested in this phase — these require a live Supabase connection
 * (dev/test branch DB credential not yet available, see the Phase 2 report's
 * "deferred" section) and are integration-tested when Phase 3/4 wire a real
 * screen to them. lib/coaching/engine.ts and everything else in this module
 * takes plain data and IS unit-tested without a DB — these functions are
 * thin adapters that produce that plain data from Supabase.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CoachingSession,
  ExperienceLevel,
  SetCreditingRule,
  TrainingLandmark,
} from './types'

type Supabase = SupabaseClient<any, any, any>

/**
 * Sessions for one split, most-recent-first, keyed by exercise_id — the
 * exercise_id-based replacement for supabase.queries.ts's
 * fetchLastSessionsFromSupabase (which keys by exercise name).
 */
export async function fetchCoachingSessions(
  supabase: Supabase,
  userProgramSplitId: string,
  maxSessions: number = 8
): Promise<CoachingSession[]> {
  const { data: workoutRows } = await supabase
    .from('workouts')
    .select('id, date, session_rpe')
    .eq('user_program_split_id', userProgramSplitId)
    .order('date', { ascending: false })
    .limit(maxSessions)

  if (!workoutRows?.length) return []

  const workoutIds = workoutRows.map(w => w.id as string)
  const workoutMeta = new Map(
    workoutRows.map(w => [w.id as string, { date: w.date as string, sessionRpe: (w.session_rpe as number | null) ?? null }])
  )

  const { data: setRows } = await supabase
    .from('sets')
    .select('workout_id, exercise_id, set_number, weight, reps, rir')
    .in('workout_id', workoutIds)
    .order('set_number', { ascending: true })

  if (!setRows?.length) return []

  const byWorkout = new Map<string, typeof setRows>()
  for (const row of setRows) {
    const wid = row.workout_id as string
    if (!byWorkout.has(wid)) byWorkout.set(wid, [])
    byWorkout.get(wid)!.push(row)
  }

  return Array.from(byWorkout.entries())
    .map(([workoutId, rows]): CoachingSession | null => {
      const meta = workoutMeta.get(workoutId)
      if (!meta) return null
      const exercises: CoachingSession['exercises'] = {}
      for (const row of rows) {
        const exerciseId = row.exercise_id as string
        if (!exercises[exerciseId]) exercises[exerciseId] = { sets: [] }
        exercises[exerciseId].sets.push({
          setNumber: row.set_number as number,
          weight: Number(row.weight),
          reps: row.reps as number,
          rir: (row.rir as number | null) ?? null,
        })
      }
      return { workoutId, date: meta.date, sessionRpe: meta.sessionRpe, exercises }
    })
    .filter((s): s is CoachingSession => s !== null)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/**
 * All of a user's recent sessions across every split (last `sinceDaysAgo`
 * days) — feeds cross-split weekly volume tallying, which a single split's
 * history can't answer on its own.
 */
export async function fetchProgramSessions(
  supabase: Supabase,
  userId: string,
  sinceDaysAgo: number = 14
): Promise<CoachingSession[]> {
  const since = new Date()
  since.setDate(since.getDate() - sinceDaysAgo)
  const sinceIso = since.toISOString().slice(0, 10)

  const { data: workoutRows } = await supabase
    .from('workouts')
    .select('id, date, session_rpe')
    .eq('user_id', userId)
    .gte('date', sinceIso)
    .order('date', { ascending: false })

  if (!workoutRows?.length) return []

  const workoutIds = workoutRows.map(w => w.id as string)
  const workoutMeta = new Map(
    workoutRows.map(w => [w.id as string, { date: w.date as string, sessionRpe: (w.session_rpe as number | null) ?? null }])
  )

  const { data: setRows } = await supabase
    .from('sets')
    .select('workout_id, exercise_id, set_number, weight, reps, rir')
    .in('workout_id', workoutIds)

  if (!setRows?.length) return []

  const byWorkout = new Map<string, typeof setRows>()
  for (const row of setRows) {
    const wid = row.workout_id as string
    if (!byWorkout.has(wid)) byWorkout.set(wid, [])
    byWorkout.get(wid)!.push(row)
  }

  return Array.from(byWorkout.entries())
    .map(([workoutId, rows]): CoachingSession | null => {
      const meta = workoutMeta.get(workoutId)
      if (!meta) return null
      const exercises: CoachingSession['exercises'] = {}
      for (const row of rows) {
        const exerciseId = row.exercise_id as string
        if (!exercises[exerciseId]) exercises[exerciseId] = { sets: [] }
        exercises[exerciseId].sets.push({
          setNumber: row.set_number as number,
          weight: Number(row.weight),
          reps: row.reps as number,
          rir: (row.rir as number | null) ?? null,
        })
      }
      return { workoutId, date: meta.date, sessionRpe: meta.sessionRpe, exercises }
    })
    .filter((s): s is CoachingSession => s !== null)
}

/**
 * Resolves each `canonicalName` to its real `exercises.id` — a plain,
 * exact-match query against the UNIQUE `name` column (not a fuzzy matcher).
 * Feeds lib/coaching/muscleTagging.ts's `exerciseIdByCanonicalName` param.
 */
export async function fetchExerciseIdsByCanonicalName(
  supabase: Supabase,
  canonicalNames: string[]
): Promise<Record<string, string>> {
  if (canonicalNames.length === 0) return {}
  const { data } = await supabase.from('exercises').select('id, name').in('name', canonicalNames)
  const result: Record<string, string> = {}
  for (const row of data ?? []) result[row.name as string] = row.id as string
  return result
}

/** Muscle tags for a set of exercise IDs (e.g. every exercise appearing in
 *  fetchProgramSessions), for lib/coaching/volume.ts's ExerciseMuscleMap. */
export async function fetchMuscleTagsByExerciseId(
  supabase: Supabase,
  exerciseIds: string[]
): Promise<Record<string, { primaryMuscles: string[]; secondaryMuscles: string[] }>> {
  if (exerciseIds.length === 0) return {}
  const { data } = await supabase
    .from('exercises')
    .select('id, primary_muscles, secondary_muscles')
    .in('id', exerciseIds)
  const result: Record<string, { primaryMuscles: string[]; secondaryMuscles: string[] }> = {}
  for (const row of data ?? []) {
    result[row.id as string] = {
      primaryMuscles: (row.primary_muscles as string[] | null) ?? [],
      secondaryMuscles: (row.secondary_muscles as string[] | null) ?? [],
    }
  }
  return result
}

/**
 * Weight overrides keyed by exercise_id — the exercise_id-based replacement
 * for supabase.queries.ts's fetchWeightOverrides (which keys by exercise
 * name via a join, matching the old name-based engine). Phase 3 wiring:
 * `exercise_weight_override.exercise_id` is already the real FK, so this is
 * a direct query with no join needed at all.
 */
export async function fetchWeightOverridesByExerciseId(
  supabase: Supabase,
  userId: string
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('exercise_weight_override')
    .select('exercise_id, override_weight')
    .eq('user_id', userId)
  const result: Record<string, number> = {}
  for (const row of data ?? []) {
    result[row.exercise_id as string] = Number(row.override_weight)
  }
  return result
}

export async function fetchExperienceLevel(supabase: Supabase, userId: string): Promise<ExperienceLevel | null> {
  const { data } = await supabase.from('users').select('experience_level').eq('id', userId).maybeSingle()
  return (data?.experience_level as ExperienceLevel | null) ?? null
}

export async function fetchLandmarks(supabase: Supabase, version: number = 1): Promise<TrainingLandmark[]> {
  const { data } = await supabase
    .from('training_landmarks')
    .select('muscle_group, experience_level, version, mev, mav, mrv, source_citation')
    .eq('version', version)
  return (data ?? []).map(row => ({
    muscleGroup: row.muscle_group as string,
    experienceLevel: row.experience_level as ExperienceLevel,
    version: row.version as number,
    mev: row.mev as number,
    mav: row.mav as number,
    mrv: row.mrv as number,
    sourceCitation: row.source_citation as string,
  }))
}

export async function fetchSetCreditingRule(supabase: Supabase, version: number = 1): Promise<SetCreditingRule | null> {
  const { data } = await supabase
    .from('set_crediting_rules')
    .select('version, primary_credit, secondary_credit, source_citation')
    .eq('version', version)
    .maybeSingle()
  if (!data) return null
  return {
    version: data.version as number,
    primaryCredit: Number(data.primary_credit),
    secondaryCredit: Number(data.secondary_credit),
    sourceCitation: data.source_citation as string,
  }
}
