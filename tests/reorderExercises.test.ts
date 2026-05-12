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
  function makeSupabase(captureUpdate: (id: string, sortOrder: number) => void) {
    return {
      from() {
        return {
          update(payload: { sort_order: number }) {
            let capturedId = ''
            const chain = {
              eq(col: string, val: string) {
                if (col === 'id') capturedId = val
                return chain
              },
              then(resolve: (r: { error: null }) => unknown) {
                captureUpdate(capturedId, payload.sort_order)
                return Promise.resolve({ error: null }).then(resolve)
              },
            }
            return chain
          },
        }
      },
    } as never
  }

  it('only updates rows whose sort_order changed', async () => {
    const updates: Array<{ id: string; sortOrder: number }> = []
    const supabase = makeSupabase((id, sortOrder) => updates.push({ id, sortOrder }))

    const current = [
      { id: 'a', sort_order: 0 },
      { id: 'b', sort_order: 1 },
      { id: 'c', sort_order: 2 },
    ]
    // Move 'a' to the end → b:0, c:1, a:2. b and c changed; a's sort_order also changed (0→2).
    await reorderExercisesInSplit(supabase, 'user-1', 'split-1', ['b', 'c', 'a'], current)

    expect(updates).toHaveLength(3)
    expect(updates).toContainEqual({ id: 'b', sortOrder: 0 })
    expect(updates).toContainEqual({ id: 'c', sortOrder: 1 })
    expect(updates).toContainEqual({ id: 'a', sortOrder: 2 })
  })

  it('writes zero rows when order is unchanged', async () => {
    const updates: Array<{ id: string; sortOrder: number }> = []
    const supabase = makeSupabase((id, sortOrder) => updates.push({ id, sortOrder }))

    const current = [
      { id: 'a', sort_order: 0 },
      { id: 'b', sort_order: 1 },
    ]
    await reorderExercisesInSplit(supabase, 'user-1', 'split-1', ['a', 'b'], current)
    expect(updates).toEqual([])
  })

  it('writes only the moved subset for an adjacent swap', async () => {
    const updates: Array<{ id: string; sortOrder: number }> = []
    const supabase = makeSupabase((id, sortOrder) => updates.push({ id, sortOrder }))

    const current = [
      { id: 'a', sort_order: 0 },
      { id: 'b', sort_order: 1 },
      { id: 'c', sort_order: 2 },
    ]
    // Swap a and b → b:0, a:1, c:2. Only a and b change.
    await reorderExercisesInSplit(supabase, 'user-1', 'split-1', ['b', 'a', 'c'], current)
    expect(updates).toHaveLength(2)
    expect(updates).toContainEqual({ id: 'b', sortOrder: 0 })
    expect(updates).toContainEqual({ id: 'a', sortOrder: 1 })
  })

  it('rejects when a supabase update returns an error', async () => {
    const supabase = {
      from() {
        return {
          update() {
            const chain = {
              eq() {
                return chain
              },
              then(resolve: (r: { error: Error }) => unknown) {
                return Promise.resolve({ error: new Error('boom') }).then(resolve)
              },
            }
            return chain
          },
        }
      },
    } as never

    await expect(
      reorderExercisesInSplit(supabase, 'u', 's', ['b', 'a'], [
        { id: 'a', sort_order: 0 },
        { id: 'b', sort_order: 1 },
      ])
    ).rejects.toThrow('boom')
  })
})

// Silence unused-import warning if any consumer of vi mocks gets added later.
void vi
