import { NextRequest, NextResponse } from 'next/server'
import { updateSessionEntry } from '@/lib/notion'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { pageId, changes } = body as {
      pageId: string
      changes: { weight?: number; reps?: number; notes?: string }
    }

    if (!pageId || typeof pageId !== 'string') {
      return NextResponse.json({ error: 'Invalid pageId' }, { status: 400 })
    }

    await updateSessionEntry(pageId, changes)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update error:', error)
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
  }
}
