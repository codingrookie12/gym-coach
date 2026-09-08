import type { SupabaseClient } from '@supabase/supabase-js'

export interface SessionRecord {
  date: string
  exercises: {
    [exerciseName: string]: {
      sets: { set: number; weight: number; reps: number }[]
    }
  }
}

type Supabase = SupabaseClient<any, any, any>

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

export interface HistorySummary {
  trainedLast7Days: number // count of unique workout days in last 7 days
  currentStreak: number // consecutive trained days (with today-or-yesterday tolerance)
  last7Dots: boolean[] // length 7, oldest → today, true = trained
  recentPR: { exerciseName: string; weight: number; unit: string; date: string } | null
  recentExerciseNames: string[] // up to 5 most-recently-trained, deduped
}

export interface HistoryProgress {
  // exerciseId: the DB `exercises.id` (uuid) this group of sets was logged
  // against — null only for legacy rows with no FK (pre-migration edge
  // case). GYM-92 fix (Phase 4): callers resolve muscle-group tagging by
  // this id (works for custom exercises, not just the static catalog),
  // never by `name` alone — see lib/progressAggregation.ts.
  exercises: { exerciseId: string | null; name: string; sets: { date: string; weight: number; reps: number; unit: string }[] }[]
  days: { date: string; count: number }[]
}

export interface ExerciseMuscleMeta {
  primaryMuscles: string[]
  secondaryMuscles: string[]
  split: string | null
}

/**
 * Muscle-group + split metadata for a set of exercise IDs, queried directly
 * from the `exercises` table — uniform for catalog-seeded AND custom rows
 * (both carry primary_muscles/secondary_muscles/split columns), unlike the
 * client-bundled static catalog (lib/exerciseLibrary.ts's ALL_EXERCISES),
 * which only knows about catalog exercises and uses a completely different
 * id space than the DB (see lib/sessionPlan.ts's docstring on that gotcha).
 * GYM-92 fix (Phase 4 scope item 1): this is what lets
 * ProgressHistoryScreen correctly group a custom exercise's sets into
 * muscle-balance aggregation instead of silently dropping them.
 */
export async function fetchExerciseMuscleMetaByIds(
  supabase: Supabase,
  exerciseIds: string[]
): Promise<Record<string, ExerciseMuscleMeta>> {
  if (!exerciseIds.length) return {}
  const { data } = await supabase
    .from('exercises')
    .select('id, primary_muscles, secondary_muscles, split')
    .in('id', exerciseIds)
  const result: Record<string, ExerciseMuscleMeta> = {}
  for (const row of data ?? []) {
    result[row.id as string] = {
      primaryMuscles: (row.primary_muscles as string[] | null) ?? [],
      secondaryMuscles: (row.secondary_muscles as string[] | null) ?? [],
      split: (row.split as string | null) ?? null,
    }
  }
  return result
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function fetchHistorySummary(supabase: Supabase, userId: string): Promise<HistorySummary> {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6) // last 7 inclusive of today
  // For streak: we look back up to 60 days
  const sixtyDaysAgo = new Date(now)
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, date')
    .eq('user_id', userId)
    .gte('date', isoDay(sixtyDaysAgo))
    .order('date', { ascending: false })

  const workoutIds = workouts?.map(w => w.id as string) ?? []
  const emptyDots = Array(7).fill(false) as boolean[]

  if (!workoutIds.length) {
    return { trainedLast7Days: 0, currentStreak: 0, last7Dots: emptyDots, recentPR: null, recentExerciseNames: [] }
  }

  // Unique trained-day set
  const trainedDays = new Set<string>(workouts!.map(w => w.date as string))

  // last7Dots: 7 booleans, oldest → today
  const last7Dots: boolean[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    last7Dots.push(trainedDays.has(isoDay(d)))
  }
  const trainedLast7Days = last7Dots.filter(Boolean).length

  // Streak: count consecutive days going back from today (or yesterday if no workout today)
  let currentStreak = 0
  const streakStart = new Date(now)
  if (!trainedDays.has(isoDay(streakStart))) streakStart.setDate(streakStart.getDate() - 1)
  while (trainedDays.has(isoDay(streakStart))) {
    currentStreak++
    streakStart.setDate(streakStart.getDate() - 1)
  }

  const { data: sets } = await supabase
    .from('sets')
    .select('workout_id, weight, reps, unit, created_at, exercises(name)')
    .in('workout_id', workoutIds)
    .eq('completed', true)
    .eq('skipped', false)

  const workoutDateMap = new Map(workouts!.map(w => [w.id as string, w.date as string]))
  const recentExerciseSeen = new Set<string>()
  const recentExerciseNames: string[] = []
  let pr: HistorySummary['recentPR'] = null

  const orderedSets = (sets ?? []).slice().sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at as string).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at as string).getTime() : 0
    return tb - ta
  })

  for (const row of orderedSets) {
    const exName = (row.exercises as any)?.name as string | undefined
    if (exName && !recentExerciseSeen.has(exName) && recentExerciseNames.length < 5) {
      recentExerciseSeen.add(exName)
      recentExerciseNames.push(exName)
    }
    if (exName) {
      const w = Number(row.weight) || 0
      const date = workoutDateMap.get(row.workout_id as string) ?? ''
      if (!pr || w > pr.weight) {
        pr = { exerciseName: exName, weight: w, unit: (row.unit as string) ?? 'Lbs', date }
      }
    }
  }

  return { trainedLast7Days, currentStreak, last7Dots, recentPR: pr, recentExerciseNames }
}

export async function fetchHistoryProgress(supabase: Supabase, userId: string): Promise<HistoryProgress> {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const start90Days = new Date(now)
  start90Days.setDate(start90Days.getDate() - 90)

  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, date')
    .eq('user_id', userId)
    .gte('date', isoDay(start90Days))
    .order('date', { ascending: true })

  const workoutIds = workouts?.map(w => w.id as string) ?? []
  if (!workoutIds.length) return { exercises: [], days: [] }

  const workoutDateMap = new Map(workouts!.map(w => [w.id as string, w.date as string]))

  const { data: sets } = await supabase
    .from('sets')
    .select('workout_id, weight, reps, unit, exercise_id, exercises(name)')
    .in('workout_id', workoutIds)
    .eq('completed', true)
    .eq('skipped', false)

  const byExercise = new Map<string, HistoryProgress['exercises'][number]>()
  const days = new Map<string, number>()

  for (const row of sets ?? []) {
    const date = workoutDateMap.get(row.workout_id as string)
    if (!date) continue
    const exName = (row.exercises as any)?.name as string | undefined
    if (!exName) continue
    const exerciseId = (row.exercise_id as string | null) ?? null
    const weight = Number(row.weight) || 0
    const reps = Number(row.reps) || 0
    const unit = (row.unit as string) ?? 'Lbs'

    // Group by exercise_id when present (GYM-92: the real FK, not the
    // display name) so a rename or name collision can never merge/split two
    // exercises incorrectly. Falls back to a name-keyed bucket only for the
    // rare legacy row with no exercise_id.
    const key = exerciseId ?? `name:${exName}`
    if (!byExercise.has(key)) byExercise.set(key, { exerciseId, name: exName, sets: [] })
    byExercise.get(key)!.sets.push({ date, weight, reps, unit })
  }

  for (const w of workouts ?? []) {
    const date = w.date as string
    days.set(date, (days.get(date) ?? 0) + 1)
  }

  return {
    exercises: Array.from(byExercise.values()).sort((a, b) => {
      const aLast = a.sets[a.sets.length - 1]?.date ?? ''
      const bLast = b.sets[b.sets.length - 1]?.date ?? ''
      return aLast < bLast ? 1 : -1
    }),
    days: Array.from(days.entries()).map(([date, count]) => ({ date, count })),
  }
}

export interface ExerciseProgressionStrip {
  pr: { weight: number; unit: string; date: string } | null
  last3: { date: string; weight: number; reps: number; unit: string }[]
  chartPoints: { x: number; y: number }[]
}

export async function fetchExerciseProgression(
  supabase: Supabase,
  userId: string,
  exerciseNames: string[]
): Promise<Record<string, ExerciseProgressionStrip>> {
  if (!exerciseNames.length) return {}

  const { data: exs } = await supabase
    .from('exercises')
    .select('id, name')
    .in('name', exerciseNames)

  const idToName = new Map<string, string>()
  for (const e of exs ?? []) idToName.set(e.id as string, e.name as string)
  if (!idToName.size) return {}

  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, date')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  const workoutDateMap = new Map<string, string>()
  for (const w of workouts ?? []) workoutDateMap.set(w.id as string, w.date as string)
  if (!workoutDateMap.size) return {}

  const { data: sets } = await supabase
    .from('sets')
    .select('workout_id, exercise_id, weight, reps, unit')
    .in('workout_id', Array.from(workoutDateMap.keys()))
    .in('exercise_id', Array.from(idToName.keys()))
    .eq('completed', true)
    .eq('skipped', false)

  type Row = { date: string; weight: number; reps: number; unit: string }
  const byName = new Map<string, Row[]>()
  for (const r of sets ?? []) {
    const name = idToName.get(r.exercise_id as string)
    const date = workoutDateMap.get(r.workout_id as string)
    if (!name || !date) continue
    const weight = Number(r.weight) || 0
    const reps = Number(r.reps) || 0
    if (!weight || !reps) continue
    const unit = (r.unit as string) ?? 'Lbs'
    const list = byName.get(name) ?? []
    list.push({ date, weight, reps, unit })
    byName.set(name, list)
  }

  const out: Record<string, ExerciseProgressionStrip> = {}
  for (const [name, rows] of Array.from(byName.entries())) {
    let pr: ExerciseProgressionStrip['pr'] = null
    for (const r of rows) {
      if (!pr || r.weight > pr.weight || (r.weight === pr.weight && r.reps > (pr as any).reps)) {
        pr = { weight: r.weight, unit: r.unit, date: r.date }
        ;(pr as any).reps = r.reps
      }
    }
    if (pr) delete (pr as any).reps

    const byDate = new Map<string, Row[]>()
    for (const r of rows) {
      const list = byDate.get(r.date) ?? []
      list.push(r)
      byDate.set(r.date, list)
    }
    const sortedDatesDesc = Array.from(byDate.keys()).sort((a, b) => a < b ? 1 : -1)

    const last3: ExerciseProgressionStrip['last3'] = sortedDatesDesc.slice(0, 3).map(date => {
      const setsOnDate = byDate.get(date)!
      const top = setsOnDate.reduce((acc, r) => r.weight > acc.weight || (r.weight === acc.weight && r.reps > acc.reps) ? r : acc, setsOnDate[0])
      return { date, weight: top.weight, reps: top.reps, unit: top.unit }
    })

    const chartDatesAsc = Array.from(byDate.keys()).sort()
    const chartPoints: ExerciseProgressionStrip['chartPoints'] = chartDatesAsc
      .slice(-12)
      .map((date, i) => ({ x: i, y: Math.max(...byDate.get(date)!.map(r => r.weight)) }))

    out[name] = { pr, last3, chartPoints }
  }

  return out
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
    .update({ exercise_name: newExerciseName, canonical_name: newExerciseName })
    .eq('user_id', userId)
    .eq('user_program_split_id', splitId)
    .eq('exercise_name', oldExerciseName)
  if (error) throw error
}

