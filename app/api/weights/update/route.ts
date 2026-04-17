import { NextRequest, NextResponse } from 'next/server'
import { writeSessionEntry } from '@/lib/notion'
import { getAllExercises } from '@/lib/routines'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { exercise: exerciseName, weight } = body

    if (!exerciseName || weight === undefined || weight === null) {
      return NextResponse.json({ error: 'Missing exercise or weight' }, { status: 400 })
    }

    const allExercises = getAllExercises()
    const ex = allExercises.find(e => e.name === exerciseName)
    if (!ex) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    }

    const today = new Date().toISOString().split('T')[0]

    await writeSessionEntry({
      exercise: ex.notionName,
      date: today,
      split: ex.split,
      weight: Number(weight),
      set: 1,
      reps: 0,
      entry: `${ex.notionName} — Weight Update`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Weight update error:', error)
    return NextResponse.json({ error: 'Failed to update weight' }, { status: 500 })
  }
}
