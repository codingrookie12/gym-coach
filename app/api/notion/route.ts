import { NextRequest, NextResponse } from 'next/server'
import { fetchLastSessions } from '@/lib/notion'
import { analyzeCoaching } from '@/lib/coaching'
import { Split } from '@/lib/routines'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const split = searchParams.get('split') as Split

  if (!split || !['Push', 'Pull', 'Legs'].includes(split)) {
    return NextResponse.json({ error: 'Invalid split' }, { status: 400 })
  }

  try {
    const sessions = await fetchLastSessions(split, 5)
    const today = new Date().toISOString().split('T')[0]
    const { context, plan } = analyzeCoaching(split, sessions, today)
    return NextResponse.json({ context, plan, sessions })
  } catch (error) {
    console.error('Notion fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
