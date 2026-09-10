/**
 * Regression coverage for app/page.tsx's handleSaveSession (Finish-time
 * save) patch-vs-noop decision — the Finish-time counterpart to
 * lib/autosavePlan.test.ts's coverage of the mid-session autosave version.
 *
 * handleSaveSession keeps its own independent copy of the patch/insert
 * partitioning (see lib/finishSaveDiff.ts's docstring for why it isn't
 * merged into planAutosave), but the per-set "did anything change since
 * last save" comparison — including the equipmentInstanceId check added in
 * 929a5bc's follow-up — is extracted here as `computeFinishSaveChanges` so
 * it's directly testable instead of only living inline inside a large
 * stateful client component.
 */
import { describe, it, expect } from 'vitest'
import { computeFinishSaveChanges, resolveFinishSyncStatus } from './finishSaveDiff'
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
      { weight: 135, reps: 6, completed: true, skipped: false, rir: 1 },
    ],
    ...overrides,
  }
}

function snapshotEntry(overrides?: Partial<SavedSnapshot[string]>): SavedSnapshot[string] {
  return {
    pageId: 'set-id-1',
    weight: 135,
    reps: 8,
    notes: '',
    rir: 2,
    ...overrides,
  }
}

describe('computeFinishSaveChanges — no-op / unrelated-field baseline', () => {
  it('returns null when nothing changed (idempotent — must never produce an empty PATCH)', () => {
    const ex = makeExercise()
    const prior = snapshotEntry()

    expect(computeFinishSaveChanges(ex.sets[0], ex, prior)).toBeNull()
  })

  it('a weight change on an already-saved set produces a patch with just that field', () => {
    const ex = makeExercise()
    const prior = snapshotEntry()
    const set = { ...ex.sets[0], weight: 145 }

    const changes = computeFinishSaveChanges(set, ex, prior)

    expect(changes).toEqual({ weight: 145 })
  })

  it('a notes change produces a patch with just notes', () => {
    const ex = makeExercise({ notes: 'felt heavy today' })
    const prior = snapshotEntry()

    const changes = computeFinishSaveChanges(ex.sets[0], ex, prior)

    expect(changes).toEqual({ notes: 'felt heavy today' })
  })

  it('a RIR change produces a patch with just rir', () => {
    const ex = makeExercise()
    const prior = snapshotEntry({ rir: null })
    const set = { ...ex.sets[0], rir: 3 }

    const changes = computeFinishSaveChanges(set, ex, prior)

    expect(changes).toEqual({ rir: 3 })
  })
})

describe('computeFinishSaveChanges — equipmentInstanceId (mirrors planAutosave\'s 929a5bc fix)', () => {
  it('no instanceId anywhere (pre-feature snapshot, untagged exercise): no spurious change', () => {
    const ex = makeExercise()
    const prior = snapshotEntry() // no equipmentInstanceId key at all

    expect(computeFinishSaveChanges(ex.sets[0], ex, prior)).toBeNull()
  })

  it('an instance-only change at Finish-time produces a patch, not a duplicate insert', () => {
    const ex = makeExercise({ equipmentInstanceId: 'instance-2' })
    const prior = snapshotEntry({ equipmentInstanceId: 'instance-1' })

    const changes = computeFinishSaveChanges(ex.sets[0], ex, prior)

    expect(changes).toEqual({ equipmentInstanceId: 'instance-2' })
    // No unrelated field should show up as "changed" alongside it.
    expect(changes).not.toHaveProperty('weight')
    expect(changes).not.toHaveProperty('reps')
    expect(changes).not.toHaveProperty('notes')
    expect(changes).not.toHaveProperty('rir')
  })

  it('re-selecting the SAME instance is a no-op (idempotent)', () => {
    const ex = makeExercise({ equipmentInstanceId: 'instance-1' })
    const prior = snapshotEntry({ equipmentInstanceId: 'instance-1' })

    expect(computeFinishSaveChanges(ex.sets[0], ex, prior)).toBeNull()
  })

  it('clearing a previously-tagged instance (undefined/null) produces a patch with equipmentInstanceId: null', () => {
    const ex = makeExercise({ equipmentInstanceId: null })
    const prior = snapshotEntry({ equipmentInstanceId: 'instance-1' })

    const changes = computeFinishSaveChanges(ex.sets[0], ex, prior)

    expect(changes).toEqual({ equipmentInstanceId: null })
  })

  it('tagging an instance for the first time on a previously-untagged, already-saved set produces a patch', () => {
    const ex = makeExercise({ equipmentInstanceId: 'instance-1' })
    const prior = snapshotEntry() // no equipmentInstanceId key at all — pre-existing row

    const changes = computeFinishSaveChanges(ex.sets[0], ex, prior)

    expect(changes).toEqual({ equipmentInstanceId: 'instance-1' })
  })

  it('undefined and null both normalize to untagged — switching between them is not a change', () => {
    const exUndefined = makeExercise({ equipmentInstanceId: undefined })
    const priorNull = snapshotEntry({ equipmentInstanceId: null })

    expect(computeFinishSaveChanges(exUndefined.sets[0], exUndefined, priorNull)).toBeNull()
  })

  it('regression: an instance-only change does not fan out into duplicate inserts (returns a single changes object per set, never null when something changed)', () => {
    // Same shape as autosavePlan.test.ts's late-RIR-edit regression: a
    // single-set change should stay scoped to that one set's patch and must
    // never be mistaken for "nothing to save" (which upstream in
    // handleSaveSession would fall to the insert branch instead, since
    // `prior` already exists here — a null return would just silently drop
    // the change, not duplicate it, but either way the caller must see a
    // non-null result to actually patch).
    const ex = makeExercise()
    ex.sets[4] = { ...ex.sets[4], rir: 3 }
    ex.equipmentInstanceId = 'instance-9'
    const prior = snapshotEntry({
      pageId: 'set-id-5',
      weight: ex.sets[4].weight,
      reps: ex.sets[4].reps,
      rir: null,
      equipmentInstanceId: 'instance-9',
    })

    const changes = computeFinishSaveChanges(ex.sets[4], ex, prior)

    expect(changes).toEqual({ rir: 3 })
    expect(changes).not.toHaveProperty('equipmentInstanceId')
  })
})

/**
 * Audit finding, pre-dating this session's write-path fixes: handleSaveSession
 * awaited its /api/session/update PATCH promises via a bare
 * `Promise.all(patchPromises)` whose settled values were destructured away
 * (`const [, wr] = await Promise.all([...])`) and never inspected. Since
 * fetch() only rejects on a genuine network failure — never on a non-2xx
 * status — a PATCH that reached the server and failed there (500, a stale
 * pageId) resolved cleanly and was silently discarded: the user's
 * pre-save correction never landed, the DB kept the stale pre-edit value,
 * and syncStatus still reported a clean 'confirmed'. Fixed by having each
 * patch promise resolve to its own ok/failure boolean (app/page.tsx) and
 * folding that into the final status here.
 */
describe('resolveFinishSyncStatus — BUG FIX: a swallowed PATCH failure must not report as confirmed', () => {
  it('all patches ok: insert status passes through unchanged (confirmed)', () => {
    expect(resolveFinishSyncStatus('confirmed', false)).toBe('confirmed')
  })

  it('all patches ok: insert status passes through unchanged (partial)', () => {
    expect(resolveFinishSyncStatus('partial', false)).toBe('partial')
  })

  it('a failed patch downgrades an otherwise-confirmed insert to partial', () => {
    expect(resolveFinishSyncStatus('confirmed', true)).toBe('partial')
  })

  it('a failed patch alongside an already-partial insert stays partial', () => {
    expect(resolveFinishSyncStatus('partial', true)).toBe('partial')
  })

  it('queued always wins — a failed patch never escalates an offline/queued session', () => {
    expect(resolveFinishSyncStatus('queued', true)).toBe('queued')
    expect(resolveFinishSyncStatus('queued', false)).toBe('queued')
  })
})
