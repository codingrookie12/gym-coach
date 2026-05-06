import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import { getTrainingModeId } from '@/lib/supabase.queries'
import type { Split } from '@/lib/routines'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { date, split }: { date: string; split: Split } = await request.json()

    const trainingModeId = await getTrainingModeId(supabase, split)
    if (!trainingModeId) return NextResponse.json({ error: 'Unknown split' }, { status: 400 })

    const { error } = await supabase
      .from('workouts')
      .update({ finished_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('date', date)
      .eq('training_mode_id', trainingModeId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Finish error:', error)
    return NextResponse.json({ error: 'Failed to record finish time' }, { status: 500 })
  }
}
