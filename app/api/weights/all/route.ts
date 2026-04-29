import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import { getAllExercises } from '@/lib/routines'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const exercises = getAllExercises()

    // Start with all nulls, then fill from exercise_weight_override
    const weights: Record<string, number | null> = {}
    for (const ex of exercises) weights[ex.name] = null

    const { data: overrides, error } = await supabase
      .from('exercise_weight_override')
      .select('override_weight, exercises(name)')
      .eq('user_id', user.id)

    if (error) throw error

    for (const row of overrides ?? []) {
      const name = (row.exercises as any)?.name as string | undefined
      if (name && name in weights) {
        weights[name] = Number(row.override_weight)
      }
    }

    return NextResponse.json({ weights })
  } catch (error) {
    console.error('Weights fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch weights' }, { status: 500 })
  }
}
