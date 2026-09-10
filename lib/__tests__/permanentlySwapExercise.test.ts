/**
 * permanentlySwapExercise (lib/supabase.queries.ts) — the "make default?"
 * confirm at the end of PreSaveSummaryScreen. Regression coverage for the
 * bug found during the session-lifecycle write-path audit: this write used
 * to have no `.select()`, so an UPDATE that matched zero rows silently
 * reported success instead of surfacing as the no-op it was. See the
 * function's own docstring for the full mechanism.
 *
 * permanentlySwapExercise takes its Supabase client as a parameter
 * (dependency-injected), so — unlike lib/customExercises.ts and other
 * modules that call createSupabaseBrowserClient() internally — it's
 * directly testable with a fake client, no module mocking needed.
 */
import { describe, it, expect, vi } from 'vitest'
import { permanentlySwapExercise } from '../supabase.queries'

function makeFakeSupabase(result: { data: unknown; error: unknown }) {
  const selectMock = vi.fn(async () => result)
  const eqExerciseNameMock = vi.fn(() => ({ select: selectMock }))
  const eqSplitMock = vi.fn(() => ({ eq: eqExerciseNameMock }))
  const eqUserMock = vi.fn(() => ({ eq: eqSplitMock }))
  const updateMock = vi.fn(() => ({ eq: eqUserMock }))
  const fromMock = vi.fn(() => ({ update: updateMock }))
  return {
    client: { from: fromMock } as any,
    fromMock, updateMock, eqUserMock, eqSplitMock, eqExerciseNameMock, selectMock,
  }
}

describe('permanentlySwapExercise', () => {
  it('a matched row resolves cleanly', async () => {
    const { client } = makeFakeSupabase({ data: [{ id: 'row-1' }], error: null })
    await expect(
      permanentlySwapExercise(client, 'user-1', 'split-1', 'Bench Press', 'Incline Press')
    ).resolves.toBeUndefined()
  })

  it('BUG FIX: zero rows matched now throws instead of silently reporting success', async () => {
    const { client } = makeFakeSupabase({ data: [], error: null })
    await expect(
      permanentlySwapExercise(client, 'user-1', 'split-1', 'Bench Press', 'Incline Press')
    ).rejects.toThrow(/no routine row found/)
  })

  it('a null data response (equivalent zero-match shape) also throws', async () => {
    const { client } = makeFakeSupabase({ data: null, error: null })
    await expect(
      permanentlySwapExercise(client, 'user-1', 'split-1', 'Bench Press', 'Incline Press')
    ).rejects.toThrow(/no routine row found/)
  })

  it('a genuine DB error is rethrown as-is', async () => {
    const dbError = new Error('connection reset')
    const { client } = makeFakeSupabase({ data: null, error: dbError })
    await expect(
      permanentlySwapExercise(client, 'user-1', 'split-1', 'Bench Press', 'Incline Press')
    ).rejects.toThrow('connection reset')
  })

  it('scopes the update to this user/split/exercise-name (never a cross-user or cross-split write)', async () => {
    const { client, updateMock, eqUserMock, eqSplitMock, eqExerciseNameMock } =
      makeFakeSupabase({ data: [{ id: 'row-1' }], error: null })

    await permanentlySwapExercise(client, 'user-1', 'split-1', 'Bench Press', 'Incline Press')

    expect(updateMock).toHaveBeenCalledWith({ exercise_name: 'Incline Press', canonical_name: 'Incline Press', added_via: 'manual-swap' })
    expect(eqUserMock).toHaveBeenCalledWith('user_id', 'user-1')
    expect(eqSplitMock).toHaveBeenCalledWith('user_program_split_id', 'split-1')
    expect(eqExerciseNameMock).toHaveBeenCalledWith('exercise_name', 'Bench Press')
  })

  it('GYM-94: re-stamps added_via to manual-swap so the row honestly reflects a manual swap, not whatever it was created as (template-clone, etc.)', async () => {
    const { client, updateMock } = makeFakeSupabase({ data: [{ id: 'row-1' }], error: null })
    await permanentlySwapExercise(client, 'user-1', 'split-1', 'Bench Press', 'Incline Press')
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ added_via: 'manual-swap' })
    )
  })

  it('retrying an already-applied swap is a safe no-op-turned-failure, not a duplicate write (idempotent UPDATE, not INSERT)', async () => {
    // First call succeeds and (in reality) moves exercise_name away from
    // 'Bench Press'. A retry with the same stale oldExerciseName now
    // correctly throws (zero match) rather than silently no-oping —
    // there is no INSERT path here, so there is no way for a retry to ever
    // produce a duplicate routine row.
    const { client } = makeFakeSupabase({ data: [], error: null })
    await expect(
      permanentlySwapExercise(client, 'user-1', 'split-1', 'Bench Press', 'Incline Press')
    ).rejects.toThrow(/no routine row found/)
  })
})
