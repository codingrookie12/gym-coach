import { NextResponse } from 'next/server'
import { fetchAllLatestWeights } from '@/lib/notion'
import { getAllExercises } from '@/lib/routines'

export async function GET() {
  try {
    const exercises = getAllExercises()
    const weights = await fetchAllLatestWeights(exercises)
    return NextResponse.json({ weights })
  } catch (error) {
    console.error('Weights fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch weights' }, { status: 500 })
  }
}
