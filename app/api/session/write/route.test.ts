/**
 * GYM-97 fix #1 regression test, plus the server-side duplicate-set
 * defense-in-depth guard.
 *
 * Before the GYM-97 fix, an entries batch whose group had no
 * `userProgramSplitId` was silently skipped (the DB insert never happened)
 * while the route still returned `{ success: true }` — the UI flashed
 * "✓ SAVED" over data that was never persisted. This confirms the route now
 * reports `success: false` (and never calls the workout-creation path) for
 * that case, and still succeeds normally when a valid `userProgramSplitId`
 * is present.
 *
 * Separately: ActiveSessionScreen's autosave effect once had a bug where the
 * normal weight→reps→RIR entry order on an exercise's last set caused every
 * completed set in that exercise to be reinserted a second time (see
 * lib/autosavePlan.ts's docstring). That's fixed client-side now, but this
 * route also carries an independent server-side guard — if an incoming
 * entry matches a (workout_id, exercise_id, set_number) that already has a
 * row, the route updates that row in place instead of inserting a
 * duplicate. The tests below exercise that guard directly at the route
 * level, independent of client correctness.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getUserMock = vi.fn(async () => ({ data: { user: { id: 'user-1' } } }))
const failedSyncsInsertMock = vi.fn(async () => ({ error: null }))

// Insert path: .from('sets').insert(rows).select('id')
const setsInsertSelectMock = vi.fn(async () => ({ data: [{ id: 'set-1' }], error: null }))
const setsInsertMock = vi.fn(() => ({ select: setsInsertSelectMock }))

// Dedup-guard existence check: .from('sets').select(...).eq('workout_id', ...).in('exercise_id', ...)
// `existingSetsRows` is mutated per-test to simulate rows already in the DB.
let existingSetsRows: { id: string; exercise_id: string; set_number: number }[] = []
const setsExistenceInMock = vi.fn(async () => ({ data: existingSetsRows, error: null }))
const setsExistenceEqMock = vi.fn(() => ({ in: setsExistenceInMock }))
const setsSelectMock = vi.fn(() => ({ eq: setsExistenceEqMock }))

// Dedup-guard update path: .from('sets').update(payload).eq('id', id)
const setsUpdateEqMock = vi.fn(async () => ({ error: null }))
const setsUpdateMock = vi.fn(() => ({ eq: setsUpdateEqMock }))

vi.mock('@/lib/supabase.server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: vi.fn((table: string) => {
      if (table === 'sets') return { insert: setsInsertMock, select: setsSelectMock, update: setsUpdateMock }
      return { insert: failedSyncsInsertMock }
    }),
  })),
}))

const getExerciseIdMock = vi.fn(async (..._args: any[]) => 'exercise-1')
const getOrCreateWorkoutMock = vi.fn(async (..._args: any[]) => 'workout-1')
const upsertWeightOverrideMock = vi.fn(async (..._args: any[]) => {})

vi.mock('@/lib/supabase.queries', () => ({
  getExerciseId: (...args: any[]) => getExerciseIdMock(...args),
  getOrCreateWorkout: (...args: any[]) => getOrCreateWorkoutMock(...args),
  upsertWeightOverride: (...args: any[]) => upsertWeightOverrideMock(...args),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/session/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/session/write', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } } as any)
    getExerciseIdMock.mockResolvedValue('exercise-1')
    getOrCreateWorkoutMock.mockResolvedValue('workout-1')
    existingSetsRows = []
  })

  it('GYM-97 fix #1: reports success:false — never a lying success:true — when an entry has no userProgramSplitId, and never creates a workout for it', async () => {
    const res = await POST(makeRequest({
      entries: [
        { exercise: 'Bench Press', date: '2026-08-26', split: 'Push', weight: 135, set: 1, reps: 8, entry: 'Bench Press — Set 1' },
      ],
    }))
    const data = await res.json()

    expect(data.success).toBe(false)
    expect(data.pageIds).toEqual([])
    expect(getOrCreateWorkoutMock).not.toHaveBeenCalled()
  })

  it('still succeeds and persists when userProgramSplitId is present', async () => {
    const res = await POST(makeRequest({
      entries: [
        {
          exercise: 'Bench Press', date: '2026-08-26', split: 'Push', weight: 135, set: 1, reps: 8,
          entry: 'Bench Press — Set 1', userProgramSplitId: 'split-1',
        },
      ],
    }))
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.pageIds).toEqual(['set-1'])
    expect(getOrCreateWorkoutMock).toHaveBeenCalledWith(expect.anything(), 'user-1', '2026-08-26', 'split-1', undefined)
    expect(setsInsertMock).toHaveBeenCalledTimes(1)
    expect(setsUpdateMock).not.toHaveBeenCalled()
  })

  it('server-side dedup guard: an entry matching an existing (workout, exercise, set_number) row is UPDATEd in place, never re-inserted', async () => {
    // Simulate a set that a previous write already persisted for this
    // exercise/set_number in this workout.
    existingSetsRows = [{ id: 'existing-set-9', exercise_id: 'exercise-1', set_number: 1 }]

    const res = await POST(makeRequest({
      entries: [
        {
          exercise: 'Bench Press', date: '2026-08-26', split: 'Push', weight: 145, set: 1, reps: 6,
          entry: 'Bench Press — Set 1', userProgramSplitId: 'split-1', rir: 2,
        },
      ],
    }))
    const data = await res.json()

    expect(data.success).toBe(true)
    // The pageId returned is the EXISTING row's id — no new row was created.
    expect(data.pageIds).toEqual(['existing-set-9'])
    expect(setsInsertMock).not.toHaveBeenCalled()
    expect(setsUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ weight: 145, reps: 6, rir: 2 }))
    expect(setsUpdateEqMock).toHaveBeenCalledWith('id', 'existing-set-9')
  })

  it('server-side dedup guard: a mixed batch inserts the new set and updates only the one that already existed', async () => {
    existingSetsRows = [{ id: 'existing-set-1', exercise_id: 'exercise-1', set_number: 1 }]

    const res = await POST(makeRequest({
      entries: [
        {
          exercise: 'Bench Press', date: '2026-08-26', split: 'Push', weight: 135, set: 1, reps: 8,
          entry: 'Bench Press — Set 1', userProgramSplitId: 'split-1',
        },
        {
          exercise: 'Bench Press', date: '2026-08-26', split: 'Push', weight: 135, set: 2, reps: 8,
          entry: 'Bench Press — Set 2', userProgramSplitId: 'split-1',
        },
      ],
    }))
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(setsUpdateMock).toHaveBeenCalledTimes(1)
    expect(setsInsertMock).toHaveBeenCalledTimes(1)
    expect(data.pageIds.sort()).toEqual(['existing-set-1', 'set-1'])
  })
})
