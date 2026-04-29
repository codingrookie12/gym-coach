import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import { getExerciseId, upsertWeightOverride } from '@/lib/supabase.queries'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { exercise: exerciseName, weight } = body

    if (!exerciseName || weight === undefined || weight === null) {
      return NextResponse.json({ error: 'Missing exercise or weight' }, { status: 400 })
    }

    const exerciseId = await getExerciseId(supabase, exerciseName)
    if (!exerciseId) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    }

    await upsertWeightOverride(supabase, user.id, exerciseId, Number(weight), 'Lbs')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Weight update error:', error)
    return NextResponse.json({ error: 'Failed to update weight' }, { status: 500 })
  }
}
