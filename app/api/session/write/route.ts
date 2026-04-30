import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import {
  getTrainingModeId,
  getExerciseId,
  getOrCreateWorkout,
  upsertWeightOverride,
} from '@/lib/supabase.queries'
import type { NotionEntry } from '@/lib/notion'
import type { Split } from '@/lib/routines'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const entries: NotionEntry[] = body.entries

    if (!entries || !Array.isArray(entries)) {
      return NextResponse.json({ error: 'Invalid entries' }, { status: 400 })
    }

    // Group by (date, split) to minimise workout lookups
    const groups = new Map<string, { date: string; split: Split; entries: NotionEntry[] }>()
    for (const entry of entries) {
      const key = `${entry.date}::${entry.split}`
      if (!groups.has(key)) groups.set(key, { date: entry.date, split: entry.split, entries: [] })
      groups.get(key)!.entries.push(entry)
    }

    // Track inserted IDs in original entry order
    const pageIds: string[] = new Array(entries.length).fill('')
    const entryIndexMap = new Map<NotionEntry, number>()
    entries.forEach((e, i) => entryIndexMap.set(e, i))

    const skipped: string[] = []

    for (const { date, split, entries: groupEntries } of Array.from(groups.values())) {
      const trainingModeId = await getTrainingModeId(supabase, split)
      if (!trainingModeId) continue
      const workoutId = await getOrCreateWorkout(supabase, user.id, date, trainingModeId)

      type InsertRow = {
        workout_id: string
        exercise_id: string
        set_number: number
        weight: number
        reps: number
        unit: string
        notes?: string
        _entry: NotionEntry
      }

      const inserts: InsertRow[] = []
      for (const entry of groupEntries) {
        const exerciseId = await getExerciseId(supabase, entry.exercise)
        if (!exerciseId) {
          if (!skipped.includes(entry.exercise)) skipped.push(entry.exercise)
          continue
        }
        inserts.push({
          workout_id: workoutId,
          exercise_id: exerciseId,
          set_number: entry.set,
          weight: entry.weight,
          reps: entry.reps,
          unit: entry.unit ?? 'Lbs',
          ...(entry.notes ? { notes: entry.notes } : {}),
          _entry: entry,
        })
      }

      if (inserts.length === 0) continue

      const { data: inserted, error } = await supabase
        .from('sets')
        .insert(inserts.map(({ _entry: _, ...row }) => row))
        .select('id')

      if (error) throw error

      inserted?.forEach((row: any, i: number) => {
        const pos = entryIndexMap.get(inserts[i]._entry)
        if (pos !== undefined) pageIds[pos] = row.id
      })

      // Update override table with max weight per exercise from this session
      const maxWeights = new Map<string, { weight: number; unit: string }>()
      for (const ins of inserts) {
        const existing = maxWeights.get(ins.exercise_id)
        if (!existing || ins.weight > existing.weight) {
          maxWeights.set(ins.exercise_id, { weight: ins.weight, unit: ins.unit })
        }
      }
      await Promise.all(
        Array.from(maxWeights.entries()).map(([exerciseId, { weight, unit }]) =>
          upsertWeightOverride(supabase, user.id, exerciseId, weight, unit)
        )
      )
    }

    return NextResponse.json({
      success: true,
      pageIds: pageIds.filter(id => id !== ''),
      ...(skipped.length > 0 ? { skipped } : {}),
    })
  } catch (error) {
    console.error('Write error:', error)
    return NextResponse.json({ error: 'Failed to write entries' }, { status: 500 })
  }
}
