import { NextResponse } from 'next/server'
import { fetchLastSessions } from '@/lib/notion'
import { Split } from '@/lib/routines'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  const splitParam = searchParams.get('split') as Split | null

  if (!name || !splitParam) {
    return NextResponse.json({ weight: null, reps: null })
  }

  try {
    const sessions = await fetchLastSessions(splitParam, 3)
    for (const session of sessions) {
      const exData = session.exercises[name]
      if (exData && exData.sets.length > 0) {
        const firstSet = exData.sets[0]
        return NextResponse.json({ weight: firstSet.weight || null, reps: firstSet.reps || null })
      }
    }
    return NextResponse.json({ weight: null, reps: null })
  } catch {
    return NextResponse.json({ weight: null, reps: null })
  }
}
