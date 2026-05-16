import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import { fetchExerciseProgression } from '@/lib/supabase.queries'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const names = Array.isArray(body?.names) ? body.names.filter((n: unknown): n is string => typeof n === 'string') : []
    if (!names.length) return NextResponse.json({})
    return NextResponse.json(await fetchExerciseProgression(supabase, user.id, names))
  } catch {
    return NextResponse.json({})
  }
}
