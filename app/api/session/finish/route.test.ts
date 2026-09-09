/**
 * POST /api/session/finish — this is the persistence boundary for the
 * session-RPE tap (PreSaveSummaryScreen's Borg CR10 picker): app/page.tsx's
 * handleSaveSession lifts `appState.sessionRpe` (set via
 * toggleSessionRpe/onSessionRpeChange) straight into this route's request
 * body, and this route decides what actually reaches `workouts.session_rpe`
 * — the column lib/coaching/data.ts reads back into `CoachingSession.sessionRpe`
 * for lib/coaching/fatigue.ts's computeSessionRpeFatigueSignal (already
 * covered by lib/coaching/__tests__/fatigue.test.ts on the consumption
 * side). Nothing previously tested this middle link — that the tapped
 * value actually lands in the update payload, or that an invalid value
 * (out of the coaching engine's assumed 1-10 range) doesn't get silently
 * persisted as if it were data-clean input.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getUserMock = vi.fn(async () => ({ data: { user: { id: 'user-1' } } }))

const workoutsUpdateEqSplitMock = vi.fn(async () => ({ error: null }))
const workoutsUpdateEqDateMock = vi.fn(() => ({ eq: workoutsUpdateEqSplitMock }))
const workoutsUpdateEqUserMock = vi.fn(() => ({ eq: workoutsUpdateEqDateMock }))
const workoutsUpdateMock = vi.fn((_payload: Record<string, unknown>) => ({ eq: workoutsUpdateEqUserMock }))

vi.mock('@/lib/supabase.server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: vi.fn((table: string) => {
      if (table === 'workouts') return { update: workoutsUpdateMock }
      throw new Error(`unexpected table: ${table}`)
    }),
  })),
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/session/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/session/finish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } } as any)
  })

  it('a tapped RPE of 7 is included verbatim in the workouts update payload', async () => {
    const res = await POST(makeRequest({ date: '2026-09-01', userProgramSplitId: 'split-1', sessionRpe: 7 }))
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(workoutsUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ session_rpe: 7, finished_at: expect.any(String) })
    )
  })

  it('boundary values 1 and 10 are both accepted', async () => {
    await POST(makeRequest({ date: '2026-09-01', userProgramSplitId: 'split-1', sessionRpe: 1 }))
    expect(workoutsUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ session_rpe: 1 }))

    vi.clearAllMocks()
    await POST(makeRequest({ date: '2026-09-01', userProgramSplitId: 'split-1', sessionRpe: 10 }))
    expect(workoutsUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ session_rpe: 10 }))
  })

  it('no RPE tapped (omitted/skippable) — finished_at is still set, session_rpe is never written', async () => {
    const res = await POST(makeRequest({ date: '2026-09-01', userProgramSplitId: 'split-1' }))
    const data = await res.json()

    expect(data.success).toBe(true)
    const payload = workoutsUpdateMock.mock.calls[0][0]
    expect(payload).toHaveProperty('finished_at')
    expect(payload).not.toHaveProperty('session_rpe')
  })

  it('an out-of-range RPE (0) is dropped rather than persisted as bad coaching-engine input', async () => {
    await POST(makeRequest({ date: '2026-09-01', userProgramSplitId: 'split-1', sessionRpe: 0 }))
    const payload = workoutsUpdateMock.mock.calls[0][0]
    expect(payload).not.toHaveProperty('session_rpe')
  })

  it('an out-of-range RPE (11) is dropped', async () => {
    await POST(makeRequest({ date: '2026-09-01', userProgramSplitId: 'split-1', sessionRpe: 11 }))
    const payload = workoutsUpdateMock.mock.calls[0][0]
    expect(payload).not.toHaveProperty('session_rpe')
  })

  it('a non-number sessionRpe is dropped rather than coerced', async () => {
    await POST(makeRequest({ date: '2026-09-01', userProgramSplitId: 'split-1', sessionRpe: '7' }))
    const payload = workoutsUpdateMock.mock.calls[0][0]
    expect(payload).not.toHaveProperty('session_rpe')
  })

  it('missing userProgramSplitId — 400, never touches the workouts table', async () => {
    const res = await POST(makeRequest({ date: '2026-09-01', sessionRpe: 5 }))
    expect(res.status).toBe(400)
    expect(workoutsUpdateMock).not.toHaveBeenCalled()
  })

  it('scopes the update to this user/date/split (never a cross-user write)', async () => {
    await POST(makeRequest({ date: '2026-09-01', userProgramSplitId: 'split-1', sessionRpe: 4 }))
    expect(workoutsUpdateEqUserMock).toHaveBeenCalledWith('user_id', 'user-1')
    expect(workoutsUpdateEqDateMock).toHaveBeenCalledWith('date', '2026-09-01')
    expect(workoutsUpdateEqSplitMock).toHaveBeenCalledWith('user_program_split_id', 'split-1')
  })
})
