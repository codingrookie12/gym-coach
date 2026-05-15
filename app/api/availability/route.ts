import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import { getExerciseId } from '@/lib/supabase.queries'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data: unavailableRows, error: availError } = await supabase
      .from('exercise_availability')
      .select('exercises(name)')
      .eq('user_id', user.id)
    if (availError) throw availError

    const unavailable = (unavailableRows ?? [])
      .map(row => (row.exercises as any)?.name as string | undefined)
      .filter((n): n is string => !!n)

    // History-derived: which equipment + exercises has this user actually trained with?
    const { data: trainedRows, error: histError } = await supabase
      .from('sets')
      .select('exercises!inner(name, equipment), workouts!inner(user_id)')
      .eq('workouts.user_id', user.id)
    if (histError) throw histError

    const trainedEquipment = new Set<string>()
    const trainedExercises = new Set<string>()
    for (const row of trainedRows ?? []) {
      const ex = (row.exercises as any) ?? null
      if (ex?.equipment) trainedEquipment.add(ex.equipment as string)
      if (ex?.name) trainedExercises.add(ex.name as string)
    }

    return NextResponse.json({
      unavailable,
      trainedEquipment: Array.from(trainedEquipment),
      trainedExercises: Array.from(trainedExercises),
    })
  } catch (error) {
    console.error('Availability fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { exercise, available } = await request.json()
    if (!exercise || typeof available !== 'boolean') {
      return NextResponse.json({ error: 'Missing exercise or available flag' }, { status: 400 })
    }

    const exerciseId = await getExerciseId(supabase, exercise)
    if (!exerciseId) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    }

    if (available) {
      const { error } = await supabase
        .from('exercise_availability')
        .delete()
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseId)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('exercise_availability')
        .upsert(
          { user_id: user.id, exercise_id: exerciseId },
          { onConflict: 'user_id,exercise_id' }
        )
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Availability update error:', error)
    return NextResponse.json({ error: 'Failed to update availability' }, { status: 500 })
  }
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { error } = await supabase
      .from('exercise_availability')
      .delete()
      .eq('user_id', user.id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Availability reset error:', error)
    return NextResponse.json({ error: 'Failed to reset availability' }, { status: 500 })
  }
}
