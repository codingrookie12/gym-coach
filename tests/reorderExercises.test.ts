import { describe, expect, it, vi } from 'vitest'
import { reorderExercisesInSplit } from '../lib/userRoutine'
import { reorderDragOffset } from '../components/hooks/usePointerReorder'

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice()
  const [m] = next.splice(from, 1)
  next.splice(to, 0, m)
  return next
}

describe('reorder math', () => {
  it('moves an item forward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an item backward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('no-op when from === to', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })
})

describe('reorderDragOffset', () => {
  const ROW = 60

  it('returns the pointer delta for the dragged row', () => {
    expect(reorderDragOffset(2, 2, 4, 100, ROW)).toBe(100)
  })

  it('shifts displaced rows up when dragging forward', () => {
    // dragging index 1 → 3: rows at index 2, 3 should shift up by ROW
    expect(reorderDragOffset(2, 1, 3, 80, ROW)).toBe(-ROW)
    expect(reorderDragOffset(3, 1, 3, 80, ROW)).toBe(-ROW)
    expect(reorderDragOffset(0, 1, 3, 80, ROW)).toBe(0)
    expect(reorderDragOffset(4, 1, 3, 80, ROW)).toBe(0)
  })

  it('shifts displaced rows down when dragging backward', () => {
    // dragging index 4 → 1: rows at index 1, 2, 3 should shift down by ROW
    expect(reorderDragOffset(1, 4, 1, -180, ROW)).toBe(ROW)
    expect(reorderDragOffset(3, 4, 1, -180, ROW)).toBe(ROW)
    expect(reorderDragOffset(0, 4, 1, -180, ROW)).toBe(0)
  })
})

describe('reorderExercisesInSplit', () => {
  function makeSupabase(captureRpc: (name: string, args: Record<string, unknown>) => void, error: Error | null = null) {
    return {
      rpc(name: string, args: Record<string, unknown>) {
        captureRpc(name, args)
        return Promise.resolve({ error })
      },
    } as never
  }

  it('calls reorder_routine_exercises RPC with the ordered ids', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = []
    const supabase = makeSupabase((name, args) => calls.push({ name, args }))

    await reorderExercisesInSplit(supabase, 'split-1', ['b', 'c', 'a'])

    expect(calls).toHaveLength(1)
    expect(calls[0].name).toBe('reorder_routine_exercises')
    expect(calls[0].args).toEqual({ p_split_id: 'split-1', p_ordered_ids: ['b', 'c', 'a'] })
  })

  it('skips the RPC when the order is empty', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = []
    const supabase = makeSupabase((name, args) => calls.push({ name, args }))

    await reorderExercisesInSplit(supabase, 'split-1', [])

    expect(calls).toEqual([])
  })

  it('rejects when the RPC returns an error', async () => {
    const supabase = makeSupabase(() => {}, new Error('boom'))
    await expect(reorderExercisesInSplit(supabase, 'split-1', ['a', 'b'])).rejects.toThrow('boom')
  })
})

// Silence unused-import warning if any consumer of vi mocks gets added later.
void vi
