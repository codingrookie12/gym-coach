import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ programId: null })

  const { data, error } = await supabase
    .from('users')
    .select('active_program_id')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Failed to read active_program_id:', error.message)
    return NextResponse.json({ programId: null })
  }

  return NextResponse.json({ programId: data?.active_program_id ?? null })
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { programId } = await request.json()
  if (!programId || typeof programId !== 'string') {
    return NextResponse.json({ error: 'Missing programId' }, { status: 400 })
  }

  const { error } = await supabase
    .from('users')
    .update({ active_program_id: programId })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to write active_program_id:', error.message)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
