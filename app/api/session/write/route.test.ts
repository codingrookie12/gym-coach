/**
 * GYM-97 fix #1 regression test.
 *
 * Before this fix, an entries batch whose group had no `userProgramSplitId`
 * was silently skipped (the DB insert never happened) while the route still
 * returned `{ success: true }` — the UI flashed "✓ SAVED" over data that was
 * never persisted. This confirms the route now reports `success: false` (and
 * never calls the workout-creation path) for that case, and still succeeds
 * normally when a valid `userProgramSplitId` is present.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getUserMock = vi.fn(async () => ({ data: { user: { id: 'user-1' } } }))
const failedSyncsInsertMock = vi.fn(async () => ({ error: null }))
const setsSelectMock = vi.fn(async () => ({ data: [{ id: 'set-1' }], error: null }))
const setsInsertMock = vi.fn(() => ({ select: setsSelectMock }))

vi.mock('@/lib/supabase.server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: vi.fn((table: string) => {
      if (table === 'sets') return { insert: setsInsertMock }
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
  })
})
