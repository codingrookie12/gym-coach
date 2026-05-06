// GYM-79: User programs collection endpoint.
// GET  → list of summaries for the authenticated user
// POST → clone a curated template OR create a fully-custom blank program
//
// Body for POST:
//   { kind: 'clone',  templateId: string, nameOverride?: string }
//   { kind: 'create', name: string, splits: [{ name, exercises: [{ name, sets, repRange }] }] }

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import {
  cloneTemplate,
  createBlankProgram,
  listUserPrograms,
  type CreateBlankProgramInput,
} from '@/lib/userProgram'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ programs: [] })

  try {
    const programs = await listUserPrograms(supabase, user.id)
    return NextResponse.json({ programs })
  } catch (err) {
    console.error('listUserPrograms failed:', err)
    return NextResponse.json({ error: 'Failed to load programs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload = body as { kind?: string; templateId?: string; nameOverride?: string; name?: string; splits?: unknown }

  try {
    if (payload.kind === 'clone') {
      if (typeof payload.templateId !== 'string') {
        return NextResponse.json({ error: 'Missing templateId' }, { status: 400 })
      }
      const programId = await cloneTemplate(supabase, user.id, payload.templateId, {
        nameOverride: typeof payload.nameOverride === 'string' ? payload.nameOverride : undefined,
      })
      return NextResponse.json({ programId })
    }

    if (payload.kind === 'create') {
      if (typeof payload.name !== 'string' || !Array.isArray(payload.splits)) {
        return NextResponse.json({ error: 'Missing name or splits' }, { status: 400 })
      }
      const programId = await createBlankProgram(supabase, user.id, {
        name: payload.name,
        splits: payload.splits,
      } as CreateBlankProgramInput)
      return NextResponse.json({ programId })
    }

    return NextResponse.json({ error: 'Unknown kind' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create program'
    console.error('POST /api/user/programs failed:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
