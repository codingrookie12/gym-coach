import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { pageId, changes } = body as {
      pageId: string
      changes: { weight?: number; reps?: number; notes?: string; rir?: number | null }
    }

    if (!pageId || typeof pageId !== 'string') {
      return NextResponse.json({ error: 'Invalid pageId' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (changes.weight !== undefined) updates.weight = changes.weight
    if (changes.reps !== undefined) updates.reps = changes.reps
    if (changes.notes !== undefined) updates.notes = changes.notes
    if (changes.rir !== undefined) updates.rir = changes.rir
    if (Object.keys(updates).length === 0) return NextResponse.json({ success: true })

    // RLS policy on sets verifies the set belongs to the authenticated user
    const { error } = await supabase
      .from('sets')
      .update(updates)
      .eq('id', pageId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update error:', error)
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
  }
}
