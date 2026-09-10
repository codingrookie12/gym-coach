import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'

// GYM-XX: Backs the DB-fallback resume path. `/api/session/today` (the
// sibling route) only tells the caller a split name/id was detected — it
// deliberately doesn't fetch full set data since that check runs on every
// app boot. This route is only hit once the user actually taps "Continue
// Today" from ResumePromptScreen with no localStorage session, and returns
// the real completed sets so handleResume() can rebuild ExerciseLog[]
// instead of no-op'ing on a screen whose only other button deletes the day.
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ found: false })

  const { searchParams } = new URL(request.url)
  const userProgramSplitId = searchParams.get('userProgramSplitId')
  if (!userProgramSplitId) return NextResponse.json({ found: false })

  const today = new Date().toISOString().split('T')[0]

  try {
    const { data: workout } = await supabase
      .from('workouts')
      .select('id, started_at')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('user_program_split_id', userProgramSplitId)
      .is('finished_at', null)
      .maybeSingle()

    if (!workout) return NextResponse.json({ found: false })

    // `unit` selected alongside the rest — equipment-type/unit-conversion
    // pass (2026-09-09): a DB-fallback resume (this route) must reconstruct
    // the exercise's already-resolved unit the same way the localStorage
    // resume path does (lib/store.ts's ExerciseLog.unit), or a session that
    // was toggled to kg before localStorage was lost would come back
    // relabeled as Lbs while still holding real kg numbers — see lib/
    // sessionResume.ts's buildResumeStateFromDb.
    //
    // `equipment_instance_id` is selected the same way, but it's on a
    // migration Johnnatan applies manually (supabase/migrations/
    // 20260909000000_equipment_model.sql) and isn't live everywhere yet.
    // Unlike the write-path's conditional-key pattern (app/api/session/
    // write/route.ts — a column is simply omitted from the insert/update
    // payload when its value is unset), a SELECT can't omit a column
    // per-row: PostgREST fails the WHOLE query (error code 42703, "column
    // does not exist") when the column isn't there at all. So this selects
    // it optimistically and falls back to the same query without it on a
    // 42703 — every resume keeps working unchanged against a database that
    // hasn't run the migration yet, and starts carrying instance data the
    // moment it has, with no further code change needed.
    const baseSetsSelect = 'id, set_number, weight, reps, notes, rir, unit'
    // eslint-disable-next-line prefer-const -- reassigned in the fallback below
    let { data: setRows, error: setsError } = (await supabase
      .from('sets')
      .select(`${baseSetsSelect}, equipment_instance_id, exercises(name)`)
      .eq('workout_id', workout.id as string)
      .order('set_number', { ascending: true })) as { data: any[] | null; error: { code?: string } | null }

    if (setsError?.code === '42703') {
      ;({ data: setRows } = await supabase
        .from('sets')
        .select(`${baseSetsSelect}, exercises(name)`)
        .eq('workout_id', workout.id as string)
        .order('set_number', { ascending: true }))
    }

    const exerciseMap = new Map<string, {
      exerciseName: string
      sets: { setNumber: number; weight: number; reps: number; notes: string; rir: number | null; pageId: string; unit: string | null; equipmentInstanceId: string | null }[]
    }>()

    for (const row of setRows ?? []) {
      const name = (row.exercises as any)?.name as string | undefined
      if (!name) continue
      if (!exerciseMap.has(name)) exerciseMap.set(name, { exerciseName: name, sets: [] })
      exerciseMap.get(name)!.sets.push({
        setNumber: row.set_number as number,
        weight: Number(row.weight),
        reps: row.reps as number,
        notes: (row.notes as string) ?? '',
        rir: (row.rir as number | null) ?? null,
        pageId: row.id as string,
        unit: (row.unit as string | null) ?? null,
        equipmentInstanceId: ((row as any).equipment_instance_id as string | null | undefined) ?? null,
      })
    }

    return NextResponse.json({
      found: true,
      startedAt: (workout.started_at as string | null) ?? null,
      exercises: Array.from(exerciseMap.values()),
    })
  } catch (error) {
    console.error('Today details error:', error)
    return NextResponse.json({ found: false })
  }
}
