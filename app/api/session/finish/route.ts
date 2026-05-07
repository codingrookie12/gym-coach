import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { date, userProgramSplitId }: { date: string; userProgramSplitId: string } = await request.json()

    if (!userProgramSplitId) {
      return NextResponse.json({ error: 'Missing userProgramSplitId' }, { status: 400 })
    }

    const { error } = await supabase
      .from('workouts')
      .update({ finished_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('date', date)
      .eq('user_program_split_id', userProgramSplitId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Finish error:', error)
    return NextResponse.json({ error: 'Failed to record finish time' }, { status: 500 })
  }
}
