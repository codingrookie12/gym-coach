import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import { fetchHistorySummary } from '@/lib/supabase.queries'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ sessionsThisWeek: 0, volumeTrend: [0, 0, 0, 0], recentPR: null, recentExerciseNames: [] })
  }
  try {
    const summary = await fetchHistorySummary(supabase, user.id)
    return NextResponse.json(summary)
  } catch {
    return NextResponse.json({ sessionsThisWeek: 0, volumeTrend: [0, 0, 0, 0], recentPR: null, recentExerciseNames: [] })
  }
}
