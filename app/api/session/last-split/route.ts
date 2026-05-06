import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ split: null, userProgramSplitId: null })

    const { data } = await supabase
      .from('workouts')
      .select('user_program_split_id, user_program_splits(name)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const split = (data?.user_program_splits as any)?.name as string | undefined
    const splitId = data?.user_program_split_id as string | undefined
    return NextResponse.json({ split: split ?? null, userProgramSplitId: splitId ?? null })
  } catch {
    return NextResponse.json({ split: null, userProgramSplitId: null })
  }
}
