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
    // sessionResume.ts's buildResumeStateFromDb. `equipment_instance_id` is
    // deliberately NOT selected here: that column is on a migration not yet
    // applied everywhere (supabase/migrations/20260909000000_equipment_
    // model.sql) — selecting an unknown column would 500 this route for
    // every resume, on every environment, not just ones using the feature.
    const { data: setRows } = await supabase
      .from('sets')
      .select('id, set_number, weight, reps, notes, rir, unit, exercises(name)')
      .eq('workout_id', workout.id as string)
      .order('set_number', { ascending: true })

    const exerciseMap = new Map<string, {
      exerciseName: string
      sets: { setNumber: number; weight: number; reps: number; notes: string; rir: number | null; pageId: string; unit: string | null }[]
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
