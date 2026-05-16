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
  sessionsThisWeek: number
  volumeTrend: number[] // last 4 weeks, oldest → newest
  recentPR: { exerciseName: string; weight: number; unit: string; date: string } | null
  recentExerciseNames: string[] // up to 5 most-recently-trained, deduped
}

export interface HistoryProgress {
  exercises: { name: string; sets: { date: string; weight: number; reps: number; unit: string }[] }[]
  weeks: { label: string; volume: number }[]
  days: { date: string; count: number }[]
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function weekKey(d: Date): string {
  const sunday = new Date(d)
  sunday.setHours(0, 0, 0, 0)
  sunday.setDate(sunday.getDate() - sunday.getDay())
  return isoDay(sunday)
}

function build12WeekLabels(startSunday: Date): { label: string }[] {
  const out: { label: string }[] = []
  const cur = new Date(startSunday)
  for (let i = 0; i < 12; i++) {
    out.push({ label: weekKey(cur) })
    cur.setDate(cur.getDate() + 7)
  }
  return out
}

export async function fetchHistorySummary(supabase: Supabase, userId: string): Promise<HistorySummary> {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const startOfWeek = new Date(now)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  const fourWeeksAgo = new Date(now)
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, date')
    .eq('user_id', userId)
    .gte('date', isoDay(fourWeeksAgo))
    .order('date', { ascending: false })

  const workoutIds = workouts?.map(w => w.id as string) ?? []
  if (!workoutIds.length) {
    return { sessionsThisWeek: 0, volumeTrend: [0, 0, 0, 0], recentPR: null, recentExerciseNames: [] }
  }

  const workoutDateMap = new Map(workouts!.map(w => [w.id as string, w.date as string]))
  const sessionsThisWeek = workouts!.filter(w => (w.date as string) >= isoDay(startOfWeek)).length

  const { data: sets } = await supabase
    .from('sets')
    .select('workout_id, weight, reps, unit, created_at, exercises(name)')
    .in('workout_id', workoutIds)
    .eq('completed', true)
    .eq('skipped', false)

  const weekBuckets = new Map<string, number>()
  for (let i = 0; i < 4; i++) {
    const d = new Date(startOfWeek)
    d.setDate(d.getDate() - i * 7)
    weekBuckets.set(weekKey(d), 0)
  }
  const recentExerciseSeen = new Set<string>()
  const recentExerciseNames: string[] = []
  let pr: HistorySummary['recentPR'] = null

  const orderedSets = (sets ?? []).slice().sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at as string).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at as string).getTime() : 0
    return tb - ta
  })

  for (const row of orderedSets) {
    const date = workoutDateMap.get(row.workout_id as string)
    if (!date) continue
    const wk = weekKey(new Date(date))
    if (weekBuckets.has(wk)) {
      const w = Number(row.weight) || 0
      const reps = Number(row.reps) || 0
      weekBuckets.set(wk, (weekBuckets.get(wk) ?? 0) + w * reps)
    }
    const exName = (row.exercises as any)?.name as string | undefined
    if (exName && !recentExerciseSeen.has(exName) && recentExerciseNames.length < 5) {
      recentExerciseSeen.add(exName)
      recentExerciseNames.push(exName)
    }
    if (exName) {
      const w = Number(row.weight) || 0
      if (!pr || w > pr.weight) {
        pr = { exerciseName: exName, weight: w, unit: (row.unit as string) ?? 'Lbs', date }
      }
    }
  }

  const volumeTrend = Array.from(weekBuckets.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, v]) => v)

  return { sessionsThisWeek, volumeTrend, recentPR: pr, recentExerciseNames }
}

export async function fetchHistoryProgress(supabase: Supabase, userId: string): Promise<HistoryProgress> {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const start12Weeks = new Date(now)
  start12Weeks.setDate(start12Weeks.getDate() - 12 * 7)
  start12Weeks.setDate(start12Weeks.getDate() - start12Weeks.getDay())
  const start90Days = new Date(now)
  start90Days.setDate(start90Days.getDate() - 90)
  const earliest = start12Weeks < start90Days ? start12Weeks : start90Days

  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, date')
    .eq('user_id', userId)
    .gte('date', isoDay(earliest))
    .order('date', { ascending: true })

  const workoutIds = workouts?.map(w => w.id as string) ?? []
  const weekLabels = build12WeekLabels(start12Weeks)
  if (!workoutIds.length) {
    return { exercises: [], weeks: weekLabels.map(({ label }) => ({ label, volume: 0 })), days: [] }
  }
  const workoutDateMap = new Map(workouts!.map(w => [w.id as string, w.date as string]))

  const { data: sets } = await supabase
    .from('sets')
    .select('workout_id, weight, reps, unit, exercises(name)')
    .in('workout_id', workoutIds)
    .eq('completed', true)
    .eq('skipped', false)

  const byExercise = new Map<string, HistoryProgress['exercises'][number]>()
  const weeks = new Map<string, number>()
  const days = new Map<string, number>()
  for (const w of weekLabels) weeks.set(w.label, 0)

  for (const row of sets ?? []) {
    const date = workoutDateMap.get(row.workout_id as string)
    if (!date) continue
    const exName = (row.exercises as any)?.name as string | undefined
    if (!exName) continue
    const weight = Number(row.weight) || 0
    const reps = Number(row.reps) || 0
    const unit = (row.unit as string) ?? 'Lbs'

    if (!byExercise.has(exName)) byExercise.set(exName, { name: exName, sets: [] })
    byExercise.get(exName)!.sets.push({ date, weight, reps, unit })

    const wk = weekKey(new Date(date))
    if (weeks.has(wk)) weeks.set(wk, (weeks.get(wk) ?? 0) + weight * reps)
  }

  for (const w of workouts ?? []) {
    const date = w.date as string
    if (date < isoDay(start90Days)) continue
    days.set(date, (days.get(date) ?? 0) + 1)
  }

  return {
    exercises: Array.from(byExercise.values()).sort((a, b) => {
      const aLast = a.sets[a.sets.length - 1]?.date ?? ''
      const bLast = b.sets[b.sets.length - 1]?.date ?? ''
      return aLast < bLast ? 1 : -1
    }),
    weeks: weekLabels.map(({ label }) => ({ label, volume: weeks.get(label) ?? 0 })),
    days: Array.from(days.entries()).map(([date, count]) => ({ date, count })),
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
    .update({ exercise_name: newExerciseName, canonical_name: newExerciseName })
    .eq('user_id', userId)
    .eq('user_program_split_id', splitId)
    .eq('exercise_name', oldExerciseName)
  if (error) throw error
}

