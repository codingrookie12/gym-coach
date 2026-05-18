// GYM-83: Routine-write endpoint.
// PATCH → reorder exercises within a split (extensible to other routine writes).
//
// Writes go through this route rather than direct browser → Supabase so that:
//   - the service worker (cache-first on cross-origin) cannot serve stale
//     reads after a write,
//   - ownership is verified server-side once, and
//   - the response returns the authoritative fresh list (no second GET).

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import { reorderExercisesInSplit } from '@/lib/userRoutine'

interface Params { params: Promise<{ splitId: string }> }

/**
 * PATCH body shape (discriminated action):
 *   { action: 'reorder', orderedIds: string[] }
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { splitId } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { action?: string; orderedIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Ownership: the split must belong to a program owned by this user.
  // user_program_splits → user_programs.user_id
  const { data: splitRow, error: splitErr } = await supabase
    .from('user_program_splits')
    .select('id, user_programs!inner(user_id)')
    .eq('id', splitId)
    .single()
  if (splitErr || !splitRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ownerId = (splitRow as unknown as { user_programs: { user_id: string } }).user_programs.user_id
  if (ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    switch (body.action) {
      case 'reorder': {
        const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : []
        if (!orderedIds.every(id => typeof id === 'string')) {
          return NextResponse.json({ error: 'orderedIds must be string[]' }, { status: 400 })
        }
        const exercises = await reorderExercisesInSplit(
          supabase,
          user.id,
          splitId,
          orderedIds as string[],
        )
        return NextResponse.json({ exercises })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update routine'
    console.error('PATCH /api/routine/[splitId] failed:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
