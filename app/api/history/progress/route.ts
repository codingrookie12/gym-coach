import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import { fetchHistoryProgress } from '@/lib/supabase.queries'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ exercises: [], weeks: [], days: [] })
  }
  try {
    const progress = await fetchHistoryProgress(supabase, user.id)
    return NextResponse.json(progress)
  } catch {
    return NextResponse.json({ exercises: [], weeks: [], days: [] })
  }
}
