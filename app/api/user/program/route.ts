import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ programId: null, userProgramId: null })

  const { data, error } = await supabase
    .from('users')
    .select('active_program_id, active_user_program_id')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Failed to read active program:', error.message)
    return NextResponse.json({ programId: null, userProgramId: null })
  }

  return NextResponse.json({
    programId: data?.active_program_id ?? null,
    userProgramId: data?.active_user_program_id ?? null,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { programId, userProgramId } = body as { programId?: string; userProgramId?: string }

  if (userProgramId && typeof userProgramId === 'string') {
    const { error } = await supabase
      .from('users')
      .update({ active_user_program_id: userProgramId })
      .eq('id', user.id)
    if (error) {
      console.error('Failed to write active_user_program_id:', error.message)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  if (programId && typeof programId === 'string') {
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

  return NextResponse.json({ error: 'Missing programId or userProgramId' }, { status: 400 })
}
