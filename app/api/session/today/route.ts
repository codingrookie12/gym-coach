import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import type { Split } from '@/lib/routines'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ found: false })

  const today = new Date().toISOString().split('T')[0]

  try {
    // Fetch today's workouts for this user, with their training mode name
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, training_modes(name)')
      .eq('user_id', user.id)
      .eq('date', today)

    if (!workouts?.length) return NextResponse.json({ found: false })

    const workoutIds = workouts.map(w => w.id as string)

    // Count sets per workout
    const { data: sets } = await supabase
      .from('sets')
      .select('workout_id')
      .in('workout_id', workoutIds)

    const setCounts: Record<string, number> = {}
    for (const s of sets ?? []) {
      const id = s.workout_id as string
      setCounts[id] = (setCounts[id] ?? 0) + 1
    }

    // Find the training mode with the most sets
    let topSplit: Split | null = null
    let topCount = 0
    for (const w of workouts) {
      const count = setCounts[w.id as string] ?? 0
      if (count > topCount) {
        topCount = count
        topSplit = (w.training_modes as any)?.name as Split
      }
    }

    if (!topSplit) return NextResponse.json({ found: false })

    return NextResponse.json({ found: true, split: topSplit, entryCount: topCount })
  } catch (error) {
    console.error('Today check error:', error)
    return NextResponse.json({ found: false })
  }
}
