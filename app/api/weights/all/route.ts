import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import { getAllExercises } from '@/lib/routines'

export interface WeightEntry {
  override: number | null
  lastUsed: number | null
  lastUsedAt: string | null  // ISO timestamp
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const exercises = getAllExercises()

    const weights: Record<string, WeightEntry> = {}
    for (const ex of exercises) weights[ex.name] = { override: null, lastUsed: null, lastUsedAt: null }

    const { data: overrides, error: overrideError } = await supabase
      .from('exercise_weight_override')
      .select('override_weight, exercises(name)')
      .eq('user_id', user.id)
    if (overrideError) throw overrideError

    for (const row of overrides ?? []) {
      const name = (row.exercises as any)?.name as string | undefined
      if (name && name in weights) {
        weights[name].override = Number(row.override_weight)
      }
    }

    // Most recent non-null weight per exercise from this user's completed sets.
    // Ordered desc by created_at; JS pass keeps first (latest) per exercise name.
    const { data: historyRows, error: historyError } = await supabase
      .from('sets')
      .select('weight, created_at, exercises!inner(name), workouts!inner(user_id)')
      .eq('workouts.user_id', user.id)
      .eq('completed', true)
      .not('weight', 'is', null)
      .order('created_at', { ascending: false })
    if (historyError) throw historyError

    const seen = new Set<string>()
    for (const row of historyRows ?? []) {
      const name = (row.exercises as any)?.name as string | undefined
      if (!name || seen.has(name) || !(name in weights)) continue
      seen.add(name)
      weights[name].lastUsed = Number(row.weight)
      weights[name].lastUsedAt = row.created_at as string
    }

    return NextResponse.json({ weights })
  } catch (error) {
    console.error('Weights fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch weights' }, { status: 500 })
  }
}
