import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import {
  getExerciseId,
  getOrCreateWorkout,
  upsertWeightOverride,
} from '@/lib/supabase.queries'

interface SessionEntry {
  exercise: string
  date: string
  split: string
  weight: number
  set: number
  reps: number
  entry: string
  notes?: string
  unit?: 'Lbs' | 'Pins'
  userProgramSplitId?: string
  /** Phase 1/2/3 joint contract (sets.rir): integer 0-5+, omitted/null =
   *  not logged. See lib/coaching/types.ts's RirValue docstring. */
  rir?: number | null
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const entries: SessionEntry[] = body.entries
    const startedAt: string | undefined = body.startedAt

    if (!entries || !Array.isArray(entries)) {
      return NextResponse.json({ error: 'Invalid entries' }, { status: 400 })
    }

    const groups = new Map<string, { date: string; userProgramSplitId: string; splitName: string; entries: SessionEntry[] }>()
    for (const entry of entries) {
      const key = `${entry.date}::${entry.userProgramSplitId ?? entry.split}`
      if (!groups.has(key)) {
        groups.set(key, {
          date: entry.date,
          userProgramSplitId: entry.userProgramSplitId ?? '',
          splitName: entry.split,
          entries: [],
        })
      }
      groups.get(key)!.entries.push(entry)
    }

    const pageIds: string[] = new Array(entries.length).fill('')
    const entryIndexMap = new Map<SessionEntry, number>()
    entries.forEach((e, i) => entryIndexMap.set(e, i))

    const skipped: string[] = []
    // GYM-97 fix #1 (defense-in-depth): a group with no userProgramSplitId
    // can't be persisted (getOrCreateWorkout requires it) — track it so the
    // response is honest instead of returning success:true while silently
    // dropping every entry in the group.
    const noSplitId: string[] = []

    for (const { date, userProgramSplitId, splitName, entries: groupEntries } of Array.from(groups.values())) {
      if (!userProgramSplitId) {
        for (const e of groupEntries) if (!noSplitId.includes(e.exercise)) noSplitId.push(e.exercise)
        continue
      }
      const workoutId = await getOrCreateWorkout(supabase, user.id, date, userProgramSplitId, startedAt)

      type InsertRow = {
        workout_id: string
        exercise_id: string
        set_number: number
        weight: number
        reps: number
        unit: string
        notes?: string
        rir?: number
        _entry: SessionEntry
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
          ...(entry.rir !== undefined && entry.rir !== null ? { rir: entry.rir } : {}),
          _entry: entry,
        })
      }

      if (inserts.length === 0) continue

      // GYM defense-in-depth: check for a row that already exists at this
      // exact (workout_id, exercise_id, set_number) before inserting. This
      // is a structural safety net independent of the client's
      // snapshot-dedup logic (lib/autosavePlan.ts) — if that ever regresses
      // (as it did once already, causing every set in an exercise to be
      // reinserted after a late RIR edit), this stops the write route from
      // silently doubling rows. A matching row is updated in place instead
      // of inserted a second time. There's no DB-level unique constraint
      // backing this yet (sets has no natural one — see the migration
      // proposal in supabase/migrations/ for review), so this is a
      // SELECT-then-branch guard rather than an atomic upsert; it closes
      // the actual bug (sequential re-autosave of already-saved sets) even
      // though it isn't fully race-proof against true concurrent writers.
      const exerciseIds = Array.from(new Set(inserts.map(r => r.exercise_id)))
      const { data: existingRows, error: existingErr } = await supabase
        .from('sets')
        .select('id, exercise_id, set_number')
        .eq('workout_id', workoutId)
        .in('exercise_id', exerciseIds)

      if (existingErr) throw existingErr

      const existingMap = new Map<string, string>() // `${exercise_id}:${set_number}` -> id
      for (const row of (existingRows ?? []) as { id: string; exercise_id: string; set_number: number }[]) {
        existingMap.set(`${row.exercise_id}:${row.set_number}`, row.id)
      }

      const freshInserts = inserts.filter(r => !existingMap.has(`${r.exercise_id}:${r.set_number}`))
      const duplicateGuardUpdates = inserts.filter(r => existingMap.has(`${r.exercise_id}:${r.set_number}`))

      if (duplicateGuardUpdates.length > 0) {
        console.warn(
          `[session/write] dedup guard: ${duplicateGuardUpdates.length} set(s) already existed for this workout/exercise/set_number — updating in place instead of inserting a duplicate row.`
        )
      }

      await Promise.all(duplicateGuardUpdates.map(async row => {
        const id = existingMap.get(`${row.exercise_id}:${row.set_number}`)!
        const { error: updateErr } = await supabase
          .from('sets')
          .update({
            weight: row.weight,
            reps: row.reps,
            unit: row.unit,
            ...(row.notes !== undefined ? { notes: row.notes } : {}),
            ...(row.rir !== undefined ? { rir: row.rir } : {}),
          })
          .eq('id', id)
        if (updateErr) throw updateErr
        const pos = entryIndexMap.get(row._entry)
        if (pos !== undefined) pageIds[pos] = id
      }))

      if (freshInserts.length > 0) {
        const { data: inserted, error } = await supabase
          .from('sets')
          .insert(freshInserts.map(({ _entry: _, ...row }) => row))
          .select('id')

        if (error) throw error

        inserted?.forEach((row: any, i: number) => {
          const pos = entryIndexMap.get(freshInserts[i]._entry)
          if (pos !== undefined) pageIds[pos] = row.id
        })
      }

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

    if (skipped.length > 0) {
      void (async () => {
        try {
          await supabase.from('failed_syncs').insert({
            user_id: user.id,
            payload: { entries: entries.filter((e: SessionEntry) => skipped.includes(e.exercise)), skippedNames: skipped },
            error_message: `Exercises not found in library: ${skipped.join(', ')}`,
          })
        } catch {}
      })()
    }

    if (noSplitId.length > 0) {
      void (async () => {
        try {
          await supabase.from('failed_syncs').insert({
            user_id: user.id,
            payload: { entries: entries.filter((e: SessionEntry) => noSplitId.includes(e.exercise)), noSplitIdNames: noSplitId },
            error_message: `Missing userProgramSplitId, entries not persisted: ${noSplitId.join(', ')}`,
          })
        } catch {}
      })()
    }

    // GYM-97 fix #1 (defense-in-depth): never report success when part of
    // the batch couldn't be persisted for lack of a split id — the caller
    // (ActiveSessionScreen's autosave, handleSaveSession) must see this as
    // a failure rather than flashing "✓ SAVED" over silently-dropped sets.
    return NextResponse.json({
      success: noSplitId.length === 0,
      pageIds: pageIds.filter(id => id !== ''),
      ...(skipped.length > 0 ? { skipped } : {}),
      ...(noSplitId.length > 0 ? { error: `Missing userProgramSplitId — not saved: ${noSplitId.join(', ')}`, unsaved: noSplitId } : {}),
    })
  } catch (error) {
    console.error('Write error:', error)
    return NextResponse.json({ error: 'Failed to write entries' }, { status: 500 })
  }
}
