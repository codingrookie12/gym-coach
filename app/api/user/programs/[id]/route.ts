// GYM-79: Single user_program endpoint.
// GET    → hydrated program (splits + exercises)
// PATCH  → rename program OR rename/add/archive/reorder splits (delegated to userProgram lib)
// DELETE → delete program (FK ON DELETE SET NULL clears active_user_program_id; throws if any
//          split has workout history — caller must archive instead)

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import {
  getUserProgram,
  renameUserProgram,
  addSplit,
  renameSplit,
  reorderSplits,
  archiveSplit,
  deleteSplit,
  splitHasWorkoutHistory,
  deleteUserProgram,
} from '@/lib/userProgram'

interface Params { params: Promise<{ id: string }> }

async function authedSupabase() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const { supabase, user } = await authedSupabase()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const program = await getUserProgram(supabase, id)
    if (!program) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (program.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ program })
  } catch (err) {
    console.error('getUserProgram failed:', err)
    return NextResponse.json({ error: 'Failed to load program' }, { status: 500 })
  }
}

/**
 * PATCH body shapes (each is a discriminated action):
 *   { action: 'rename',           name: string }
 *   { action: 'add-split',        name: string }
 *   { action: 'rename-split',     splitId: string, name: string }
 *   { action: 'reorder-splits',   splitIds: string[] }
 *   { action: 'archive-split',    splitId: string }
 *   { action: 'remove-split',     splitId: string }   // archives if it has workout history
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const { supabase, user } = await authedSupabase()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Verify ownership before any mutation.
  const program = await getUserProgram(supabase, id)
  if (!program) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (program.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    switch (body.action) {
      case 'rename':
        await renameUserProgram(supabase, id, String(body.name ?? ''))
        return NextResponse.json({ success: true })

      case 'add-split': {
        const splitId = await addSplit(supabase, id, String(body.name ?? ''))
        return NextResponse.json({ splitId })
      }

      case 'rename-split':
        if (!program.splits.some(s => s.id === body.splitId)) {
          return NextResponse.json({ error: 'Split not in program' }, { status: 403 })
        }
        await renameSplit(supabase, String(body.splitId), String(body.name ?? ''))
        return NextResponse.json({ success: true })

      case 'reorder-splits': {
        const splitIds: string[] = Array.isArray(body.splitIds) ? body.splitIds : []
        for (const sid of splitIds) {
          if (!program.splits.some(s => s.id === sid)) {
            return NextResponse.json({ error: 'Split not in program' }, { status: 403 })
          }
        }
        await reorderSplits(supabase, splitIds)
        return NextResponse.json({ success: true })
      }

      case 'archive-split':
        if (!program.splits.some(s => s.id === body.splitId)) {
          return NextResponse.json({ error: 'Split not in program' }, { status: 403 })
        }
        await archiveSplit(supabase, String(body.splitId))
        return NextResponse.json({ success: true })

      case 'remove-split': {
        const splitId = String(body.splitId)
        if (!program.splits.some(s => s.id === splitId)) {
          return NextResponse.json({ error: 'Split not in program' }, { status: 403 })
        }
        if (await splitHasWorkoutHistory(supabase, splitId)) {
          await archiveSplit(supabase, splitId)
          return NextResponse.json({ success: true, archived: true })
        }
        await deleteSplit(supabase, splitId)
        return NextResponse.json({ success: true, archived: false })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update program'
    console.error('PATCH /api/user/programs/[id] failed:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const { supabase, user } = await authedSupabase()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Ownership check
  const program = await getUserProgram(supabase, id)
  if (!program) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (program.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await deleteUserProgram(supabase, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete program'
    console.error('DELETE /api/user/programs/[id] failed:', message)
    // Most likely cause: a split has workout history (ON DELETE RESTRICT).
    // Caller should archive the split instead and try again.
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
