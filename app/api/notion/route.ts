import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import { fetchLastSessionsFromSupabase, fetchWeightOverrides } from '@/lib/supabase.queries'
import { analyzeCoaching } from '@/lib/coaching'
import { getRoutineAsExercises } from '@/lib/userProgram'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userProgramSplitId = searchParams.get('userProgramSplitId')

  if (!userProgramSplitId) {
    return NextResponse.json({ error: 'Missing userProgramSplitId' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const programId = searchParams.get('programId') ?? 'custom'
    const split = searchParams.get('split') ?? ''
    const unavailableParam = searchParams.get('unavailable') ?? ''
    const unavailableExercises = unavailableParam
      ? unavailableParam.split(',').map(s => s.trim()).filter(Boolean)
      : []

    const [sessions, weightOverrides, routine] = await Promise.all([
      fetchLastSessionsFromSupabase(supabase, userProgramSplitId, 5),
      fetchWeightOverrides(supabase, user.id),
      getRoutineAsExercises(supabase, userProgramSplitId),
    ])
    const today = new Date().toISOString().split('T')[0]
    const { context, plan } = analyzeCoaching(programId, split, sessions, today, unavailableExercises, weightOverrides, routine)
    return NextResponse.json({ context, plan, sessions })
  } catch (error) {
    console.error('Session history fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
