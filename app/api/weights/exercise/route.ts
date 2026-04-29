import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import { getExerciseId } from '@/lib/supabase.queries'

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ weight: null, reps: null })

  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')

  if (!name) return NextResponse.json({ weight: null, reps: null })

  try {
    const exerciseId = await getExerciseId(supabase, name)
    if (!exerciseId) return NextResponse.json({ weight: null, reps: null })

    // Weight from override table (primary source)
    const { data: override } = await supabase
      .from('exercise_weight_override')
      .select('override_weight')
      .eq('user_id', user.id)
      .eq('exercise_id', exerciseId)
      .maybeSingle()

    // Latest reps from most recent set (override table doesn't store reps)
    const { data: latestSet } = await supabase
      .from('sets')
      .select('reps')
      .eq('exercise_id', exerciseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      weight: override?.override_weight != null ? Number(override.override_weight) : null,
      reps: latestSet?.reps ?? null,
    })
  } catch {
    return NextResponse.json({ weight: null, reps: null })
  }
}
