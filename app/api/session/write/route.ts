import { NextRequest, NextResponse } from 'next/server'
import { writeSessionEntries, NotionEntry } from '@/lib/notion'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const entries: NotionEntry[] = body.entries

    if (!entries || !Array.isArray(entries)) {
      return NextResponse.json({ error: 'Invalid entries' }, { status: 400 })
    }

    const pageIds = await writeSessionEntries(entries)
    return NextResponse.json({ success: true, pageIds })
  } catch (error) {
    console.error('Write error:', error)
    return NextResponse.json({ error: 'Failed to write entries' }, { status: 500 })
  }
}
