import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ found: false })

  const today = new Date().toISOString().split('T')[0]

  try {
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, user_program_split_id, user_program_splits(name)')
      .eq('user_id', user.id)
      .eq('date', today)
      .is('finished_at', null)

    if (!workouts?.length) return NextResponse.json({ found: false })

    const workoutIds = workouts.map(w => w.id as string)

    const { data: sets } = await supabase
      .from('sets')
      .select('workout_id')
      .in('workout_id', workoutIds)

    const setCounts: Record<string, number> = {}
    for (const s of sets ?? []) {
      const id = s.workout_id as string
      setCounts[id] = (setCounts[id] ?? 0) + 1
    }

    let topSplitName: string | null = null
    let topSplitId: string | null = null
    let topCount = 0
    for (const w of workouts) {
      const count = setCounts[w.id as string] ?? 0
      if (count > topCount) {
        topCount = count
        topSplitName = (w.user_program_splits as any)?.name as string
        topSplitId = w.user_program_split_id as string
      }
    }

    if (!topSplitName || !topSplitId) return NextResponse.json({ found: false })

    return NextResponse.json({ found: true, split: topSplitName, userProgramSplitId: topSplitId, entryCount: topCount })
  } catch (error) {
    console.error('Today check error:', error)
    return NextResponse.json({ found: false })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const userProgramSplitId = searchParams.get('userProgramSplitId')
  if (!userProgramSplitId) {
    return NextResponse.json({ error: 'userProgramSplitId required' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    const { data: deleted, error } = await supabase
      .from('workouts')
      .delete()
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('user_program_split_id', userProgramSplitId)
      .is('finished_at', null)
      .select('id')

    if (error) throw error

    return NextResponse.json({ deleted: { workouts: deleted?.length ?? 0 } })
  } catch (error) {
    console.error('Today discard error:', error)
    return NextResponse.json({ error: 'Failed to discard today' }, { status: 500 })
  }
}
