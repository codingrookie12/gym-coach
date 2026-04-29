import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import type { Split } from '@/lib/routines'

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ split: null })

    const { data } = await supabase
      .from('workouts')
      .select('training_modes(name)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const split = (data?.training_modes as any)?.name as Split | undefined
    return NextResponse.json({ split: split ?? null })
  } catch {
    return NextResponse.json({ split: null })
  }
}
