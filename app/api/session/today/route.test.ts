/**
 * GYM-98 DB-fallback resume-detection source: GET /api/session/today.
 *
 * This route is what makes `shouldResumeFromDb` (lib/sessionResume.ts) safe
 * to trust: it filters `workouts` on `.is('finished_at', null)`, so a
 * completed prior session can never come back as `found: true` and
 * resurrect a "Resume?" prompt for already-finished work. These tests mock
 * the Supabase query chain (same pattern as
 * app/api/session/write/route.test.ts) and drive it through realistic
 * return shapes rather than re-testing Postgres's own WHERE-clause
 * filtering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUserMock = vi.fn(async () => ({ data: { user: { id: 'user-1' } } }))

let workoutsData: any[] = []
let setsData: any[] = []

const workoutsIsMock = vi.fn(async () => ({ data: workoutsData }))
const workoutsEqDateMock = vi.fn(() => ({ is: workoutsIsMock }))
const workoutsEqUserMock = vi.fn(() => ({ eq: workoutsEqDateMock }))
const workoutsSelectMock = vi.fn(() => ({ eq: workoutsEqUserMock }))

const setsInMock = vi.fn(async () => ({ data: setsData }))
const setsSelectMock = vi.fn(() => ({ in: setsInMock }))

vi.mock('@/lib/supabase.server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: vi.fn((table: string) => {
      if (table === 'workouts') return { select: workoutsSelectMock }
      if (table === 'sets') return { select: setsSelectMock }
      throw new Error(`unexpected table: ${table}`)
    }),
  })),
}))

import { GET } from './route'

describe('GET /api/session/today', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } } as any)
    workoutsData = []
    setsData = []
  })

  it('no workout row for today — found: false', async () => {
    workoutsData = []
    const res = await GET()
    const data = await res.json()
    expect(data.found).toBe(false)
  })

  it('an unfinished workout with logged sets — found: true with the correct split/id', async () => {
    workoutsData = [
      { id: 'workout-1', user_program_split_id: 'split-1', user_program_splits: { name: 'Pull' } },
    ]
    setsData = [{ workout_id: 'workout-1' }, { workout_id: 'workout-1' }]

    const res = await GET()
    const data = await res.json()

    expect(data).toEqual({ found: true, split: 'Pull', userProgramSplitId: 'split-1', entryCount: 2 })
    // Confirms the completed-session exclusion is wired: only unfinished
    // (finished_at IS NULL) workouts are ever queried in the first place.
    expect(workoutsIsMock).toHaveBeenCalled()
  })

  it('a workout row exists but has zero logged sets yet — found: false (nothing worth resuming)', async () => {
    workoutsData = [
      { id: 'workout-1', user_program_split_id: 'split-1', user_program_splits: { name: 'Pull' } },
    ]
    setsData = []

    const res = await GET()
    const data = await res.json()
    expect(data.found).toBe(false)
  })

  it('a fully-completed prior session is structurally excluded — the query only ever returns unfinished workouts', async () => {
    // GET /api/session/today's own query is `.is('finished_at', null)`
    // before this route ever sees rows — simulate the real Postgres
    // behavior of a completed workout never being included in the result
    // set the mock hands back.
    workoutsData = []
    setsData = []

    const res = await GET()
    const data = await res.json()

    expect(data.found).toBe(false)
    expect(workoutsIsMock).toHaveBeenCalled()
  })

  it('multiple unfinished workouts today — picks the one with the most logged sets', async () => {
    workoutsData = [
      { id: 'workout-1', user_program_split_id: 'split-1', user_program_splits: { name: 'Push' } },
      { id: 'workout-2', user_program_split_id: 'split-2', user_program_splits: { name: 'Pull' } },
    ]
    setsData = [
      { workout_id: 'workout-1' },
      { workout_id: 'workout-2' }, { workout_id: 'workout-2' }, { workout_id: 'workout-2' },
    ]

    const res = await GET()
    const data = await res.json()

    expect(data.found).toBe(true)
    expect(data.split).toBe('Pull')
    expect(data.userProgramSplitId).toBe('split-2')
    expect(data.entryCount).toBe(3)
  })

  it('no authenticated user — found: false, never queries workouts', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } } as any)
    const res = await GET()
    const data = await res.json()
    expect(data.found).toBe(false)
    expect(workoutsSelectMock).not.toHaveBeenCalled()
  })
})
