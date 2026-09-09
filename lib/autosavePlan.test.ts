/**
 * Regression test for the ActiveSessionScreen autosave duplicate-row bug.
 *
 * Root cause: a set's `completed` flag flips true the instant reps are
 * confirmed, independent of RIR (entered last per the UI). So the normal
 * weight→reps→RIR order on any exercise's *last* set fires autosave
 * (inserting every completed set so far) before that set's RIR is recorded.
 * `selectRir()` then deletes the exercise from `savedExIndices` to let the
 * late RIR reach the DB — but the old autosave effect had no memory of
 * which sets it already inserted, so the next autosave pass reinserted
 * every set in the exercise a second time. One 5-set exercise produced 10
 * rows in the dev DB, with the first 5 left stale (rir: null).
 *
 * `planAutosave` is the snapshot-aware fix: a set already in the
 * SavedSnapshot must only ever be patched, never re-inserted.
 */
import { describe, it, expect } from 'vitest'
import { planAutosave } from './autosavePlan'
import { ExerciseLog, SavedSnapshot } from './store'

function makeExercise(overrides?: Partial<ExerciseLog>): ExerciseLog {
  return {
    exerciseName: 'Bench Press',
    canonicalName: 'Bench Press',
    backupName: null,
    notes: '',
    sets: [
      { weight: 135, reps: 8, completed: true, skipped: false, rir: 2 },
      { weight: 135, reps: 8, completed: true, skipped: false, rir: 2 },
      { weight: 135, reps: 8, completed: true, skipped: false, rir: 1 },
      { weight: 135, reps: 7, completed: true, skipped: false, rir: 1 },
      // Last set: weight+reps confirmed, RIR not entered yet — the exact
      // trigger state for the bug (allDone is true, rir still null).
      { weight: 135, reps: 6, completed: true, skipped: false, rir: null },
    ],
    ...overrides,
  }
}

const opts = { date: '2026-09-07', split: 'Push', weightUnit: 'Lbs' as const, userProgramSplitId: 'split-1' }

describe('planAutosave — GYM duplicate-set regression', () => {
  it('first pass (nothing saved yet): inserts all 5 completed sets, patches none', () => {
    const ex = makeExercise()
    const plan = planAutosave(ex, opts, {})

    expect(plan.toInsert).toHaveLength(5)
    expect(plan.insertSetNumbers).toEqual([1, 2, 3, 4, 5])
    expect(plan.toPatch).toHaveLength(0)
  })

  it('second pass, after the late RIR edit on set 5: never re-inserts already-saved sets — only patches the one that changed', () => {
    const ex = makeExercise()

    // Simulate what the first autosave pass wrote: all 5 sets already
    // persisted, set 5 saved with rir: null (RIR hadn't been entered yet).
    const snapshot: SavedSnapshot = {}
    ex.sets.forEach((set, i) => {
      snapshot[`${ex.exerciseName}:${i + 1}`] = {
        pageId: `set-id-${i + 1}`,
        weight: set.weight,
        reps: set.reps,
        notes: ex.notes ?? '',
        rir: i === 4 ? null : set.rir, // set 5 was saved before its RIR existed
      }
    })

    // selectRir(4, 3) fires: set 5's RIR is now recorded.
    const exAfterRir = makeExercise()
    exAfterRir.sets[4] = { ...exAfterRir.sets[4], rir: 3 }

    const plan = planAutosave(exAfterRir, opts, snapshot)

    // The core assertion: nothing gets re-inserted. Duplicating all 5 rows
    // (the actual bug) would show up here as toInsert.length === 5.
    expect(plan.toInsert).toHaveLength(0)

    // Exactly one patch — for set 5's changed RIR — targeting its existing pageId.
    expect(plan.toPatch).toHaveLength(1)
    expect(plan.toPatch[0]).toMatchObject({
      pageId: 'set-id-5',
      key: 'Bench Press:5',
      changes: { rir: 3 },
    })
  })

  it('a re-run with no actual changes produces neither inserts nor patches (idempotent)', () => {
    const ex = makeExercise()
    const snapshot: SavedSnapshot = {}
    ex.sets.forEach((set, i) => {
      snapshot[`${ex.exerciseName}:${i + 1}`] = {
        pageId: `set-id-${i + 1}`,
        weight: set.weight,
        reps: set.reps,
        notes: ex.notes ?? '',
        rir: set.rir ?? null,
      }
    })

    const plan = planAutosave(ex, opts, snapshot)

    expect(plan.toInsert).toHaveLength(0)
    expect(plan.toPatch).toHaveLength(0)
  })

  it('a weight or notes edit on an already-saved set produces a patch, not an insert', () => {
    const ex = makeExercise()
    const snapshot: SavedSnapshot = {}
    ex.sets.forEach((set, i) => {
      snapshot[`${ex.exerciseName}:${i + 1}`] = {
        pageId: `set-id-${i + 1}`,
        weight: set.weight,
        reps: set.reps,
        notes: '',
        rir: set.rir ?? null,
      }
    })

    const edited = makeExercise({ notes: 'felt heavy today' })
    const plan = planAutosave(edited, opts, snapshot)

    expect(plan.toInsert).toHaveLength(0)
    // Notes are exercise-wide, so every saved set picks up the notes change.
    expect(plan.toPatch).toHaveLength(5)
    plan.toPatch.forEach(p => expect(p.changes).toMatchObject({ notes: 'felt heavy today' }))
  })

  it('a brand-new set added after the exercise was already saved is inserted, not patched', () => {
    const ex = makeExercise()
    const snapshot: SavedSnapshot = {}
    ex.sets.slice(0, 4).forEach((set, i) => {
      snapshot[`${ex.exerciseName}:${i + 1}`] = {
        pageId: `set-id-${i + 1}`,
        weight: set.weight,
        reps: set.reps,
        notes: '',
        rir: set.rir ?? null,
      }
    })
    // Set 5 was never saved (e.g. added via "Add Set" after the fact).

    const plan = planAutosave(ex, opts, snapshot)

    expect(plan.toPatch).toHaveLength(0)
    expect(plan.toInsert).toHaveLength(1)
    expect(plan.insertSetNumbers).toEqual([5])
  })
})
