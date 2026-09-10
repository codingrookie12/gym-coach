/**
 * Data-consistency audit (2026-09): weight-override staleness on a
 * post-autosave weight edit.
 *
 * /api/session/write's upsertWeightOverride call only ever fires for sets in
 * its own `toInsert` batch. Once a set has already been autosaved once,
 * planAutosave (lib/autosavePlan.ts) routes any further edit to it — a late
 * weight correction, a PR fix-up, an edit made from the Finish/pre-save
 * screen — through this PATCH route instead, which previously touched only
 * the `sets` row. exercise_weight_override then silently kept whatever
 * weight the FIRST autosave call recorded, even after the true weight
 * changed — stale data feeding ManageWeightsScreen, the add-mid-session
 * pre-fill (/api/weights/exercise), and the coaching engine's no-history
 * fallback. These tests confirm the route now re-syncs the override to the
 * post-edit max weight for that workout+exercise, without ever turning an
 * otherwise-successful set update into a reported failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getUserMock = vi.fn(async () => ({ data: { user: { id: 'user-1' } } }))

// .from('sets').update(updates).eq('id', pageId)
const setsUpdateEqMock = vi.fn(async () => ({ error: null }))
const setsUpdateMock = vi.fn(() => ({ eq: setsUpdateEqMock }))

// Post-update lookup: .from('sets').select('workout_id, exercise_id, unit').eq('id', pageId).maybeSingle()
let setRow: { workout_id: string; exercise_id: string; unit: string } | null = {
  workout_id: 'workout-1', exercise_id: 'exercise-1', unit: 'Lbs',
}
const setRowMaybeSingleMock = vi.fn(async () => ({ data: setRow, error: null }))
const setRowEqMock = vi.fn(() => ({ maybeSingle: setRowMaybeSingleMock }))

// Max-weight recompute: .from('sets').select('weight').eq('workout_id', ..).eq('exercise_id', ..)
let exerciseSetsRows: { weight: number }[] = []
const exerciseSetsEqEqMock = vi.fn(async () => ({ data: exerciseSetsRows, error: null }))
const exerciseSetsEqMock = vi.fn(() => ({ eq: exerciseSetsEqEqMock }))

// Two different .select(...) shapes share the 'sets' table — dispatch on the
// select string since both start from the same `.from('sets')` call.
const setsSelectMock = vi.fn((cols: string) => {
  if (cols.includes('workout_id')) return { eq: setRowEqMock }
  return { eq: exerciseSetsEqMock }
})

vi.mock('@/lib/supabase.server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: vi.fn((table: string) => {
      if (table === 'sets') return { update: setsUpdateMock, select: setsSelectMock }
      return {}
    }),
  })),
}))

const upsertWeightOverrideMock = vi.fn(async (..._args: any[]) => {})
vi.mock('@/lib/supabase.queries', () => ({
  upsertWeightOverride: (...args: any[]) => upsertWeightOverrideMock(...args),
}))

import { PATCH } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/session/update', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/session/update — weight-override re-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } } as any)
    setRow = { workout_id: 'workout-1', exercise_id: 'exercise-1', unit: 'Lbs' }
    exerciseSetsRows = []
  })

  it('recomputes and re-upserts the override to the post-edit max weight for the workout+exercise', async () => {
    // Session had 135/135/95 originally; the last set is corrected to 145 (a PR).
    exerciseSetsRows = [{ weight: 135 }, { weight: 135 }, { weight: 145 }]

    const res = await PATCH(makeRequest({ pageId: 'set-3', changes: { weight: 145 } }))
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(setsUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ weight: 145 }))
    expect(upsertWeightOverrideMock).toHaveBeenCalledWith(expect.anything(), 'user-1', 'exercise-1', 145, 'Lbs')
  })

  it('drops the override back down when a correction lowers the true max (e.g. a fat-fingered entry fixed)', async () => {
    exerciseSetsRows = [{ weight: 105 }, { weight: 100 }]

    const res = await PATCH(makeRequest({ pageId: 'set-1', changes: { weight: 105 } }))
    await res.json()

    expect(upsertWeightOverrideMock).toHaveBeenCalledWith(expect.anything(), 'user-1', 'exercise-1', 105, 'Lbs')
  })

  it('does not touch the override at all when the edit has no weight change (rir/notes-only edit)', async () => {
    const res = await PATCH(makeRequest({ pageId: 'set-1', changes: { rir: 2 } }))
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(setsUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ rir: 2 }))
    expect(upsertWeightOverrideMock).not.toHaveBeenCalled()
  })

  it('still reports success for the set update even if the override re-sync lookup fails', async () => {
    setRowMaybeSingleMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } } as any)

    const res = await PATCH(makeRequest({ pageId: 'set-1', changes: { weight: 150 } }))
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(upsertWeightOverrideMock).not.toHaveBeenCalled()
  })

  it('still reports success for the set update even if the max-weight recompute query errors', async () => {
    exerciseSetsEqEqMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } } as any)

    const res = await PATCH(makeRequest({ pageId: 'set-1', changes: { weight: 150 } }))
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(upsertWeightOverrideMock).not.toHaveBeenCalled()
  })

  it('falls back to Lbs when the set row unexpectedly has no unit', async () => {
    setRow = { workout_id: 'workout-1', exercise_id: 'exercise-1', unit: null as unknown as string }
    exerciseSetsRows = [{ weight: 90 }]

    const res = await PATCH(makeRequest({ pageId: 'set-1', changes: { weight: 90 } }))
    await res.json()

    expect(upsertWeightOverrideMock).toHaveBeenCalledWith(expect.anything(), 'user-1', 'exercise-1', 90, 'Lbs')
  })
})
