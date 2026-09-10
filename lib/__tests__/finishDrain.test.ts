/**
 * Pending-finish queue drain logic (lib/finishDrain.ts) — the fix for the
 * session-lifecycle audit finding: `/api/session/finish` used to be
 * fire-and-forget with no retry. Offline, it was never even attempted;
 * online, a failed request (network blip, 5xx, even a 400) was silently
 * swallowed. Either way `workouts.finished_at` stayed permanently NULL for
 * an otherwise fully-logged, already-saved session — and since
 * `/api/session/today` resumes any workout with `finished_at IS NULL`, and
 * "Start Fresh" on that resume prompt hard-deletes the workout row
 * (`ON DELETE CASCADE` to `sets` — supabase/migrations/20260423000000_
 * initial_schema.sql), this was a real path to silently losing an entire
 * completed workout's data.
 *
 * Mirrors lib/__tests__/outboxDrain.test.ts's coverage shape exactly, since
 * lib/finishDrain.ts intentionally mirrors lib/outboxDrain.ts's semantics.
 */
import { describe, it, expect, beforeEach } from 'vitest'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
  removeItem(key: string): void { this.store.delete(key) }
  setItem(key: string, value: string): void { this.store.set(key, value) }
}

beforeEach(() => {
  ;(globalThis as any).localStorage = new MemoryStorage()
})

import { enqueuePendingFinish, readPendingFinishes } from '../sessionStorage'
import { drainPendingFinishesOnce, drainPendingFinishes, __resetFinishDrainGuardForTests } from '../finishDrain'

beforeEach(() => {
  __resetFinishDrainGuardForTests()
})

describe('drainPendingFinishesOnce', () => {
  it('reconnect drains the queue and confirms every entry (removes it on 2xx)', async () => {
    enqueuePendingFinish('user-a', { date: '2026-09-07', userProgramSplitId: 'split-1', sessionRpe: 7 })
    enqueuePendingFinish('user-a', { date: '2026-09-07', userProgramSplitId: 'split-2', sessionRpe: null })

    const calls: unknown[] = []
    const result = await drainPendingFinishesOnce('user-a', {
      fetchFinish: async (body) => { calls.push(body); return { ok: true, status: 200 } },
    })

    expect(calls).toHaveLength(2)
    expect(result.drainedIds).toHaveLength(2)
    expect(result.remaining).toBe(0)
    expect(readPendingFinishes('user-a')).toEqual([])
  })

  it('a network error mid-drain leaves that entry AND every entry after it queued — no data loss', async () => {
    enqueuePendingFinish('user-a', { date: '2026-09-07', userProgramSplitId: 'split-1' })
    enqueuePendingFinish('user-a', { date: '2026-09-07', userProgramSplitId: 'split-2' })
    enqueuePendingFinish('user-a', { date: '2026-09-07', userProgramSplitId: 'split-3' })

    let call = 0
    const result = await drainPendingFinishesOnce('user-a', {
      fetchFinish: async () => {
        call += 1
        if (call === 2) throw new Error('network down')
        return { ok: true, status: 200 }
      },
    })

    expect(result.drainedIds).toHaveLength(1)
    expect(result.remaining).toBe(2)
    expect(readPendingFinishes('user-a').map(e => e.body.userProgramSplitId)).toEqual(['split-2', 'split-3'])
  })

  it('a 5xx leaves the entry queued but does not block later entries in the same batch', async () => {
    enqueuePendingFinish('user-a', { date: '2026-09-07', userProgramSplitId: 'split-1' })
    enqueuePendingFinish('user-a', { date: '2026-09-07', userProgramSplitId: 'split-2' })

    let call = 0
    const result = await drainPendingFinishesOnce('user-a', {
      fetchFinish: async () => {
        call += 1
        return call === 1 ? { ok: false, status: 500 } : { ok: true, status: 200 }
      },
    })

    expect(result.drainedIds).toHaveLength(1)
    expect(result.remaining).toBe(1)
    expect(readPendingFinishes('user-a').map(e => e.body.userProgramSplitId)).toEqual(['split-1'])
  })

  it('a 4xx is dropped permanently rather than retried forever', async () => {
    enqueuePendingFinish('user-a', { date: '2026-09-07', userProgramSplitId: 'split-1' })

    const result = await drainPendingFinishesOnce('user-a', {
      fetchFinish: async () => ({ ok: false, status: 400 }),
    })

    expect(result.droppedIds).toHaveLength(1)
    expect(result.remaining).toBe(0)
    expect(readPendingFinishes('user-a')).toEqual([])
  })

  it('an empty queue is a no-op — never calls the network', async () => {
    let called = false
    const result = await drainPendingFinishesOnce('user-a', {
      fetchFinish: async () => { called = true; return { ok: true, status: 200 } },
    })
    expect(called).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('two sessions finished the same day (AM/PM split) both drain independently — the second does not clobber the first', async () => {
    enqueuePendingFinish('user-a', { date: '2026-09-07', userProgramSplitId: 'am-split' })
    enqueuePendingFinish('user-a', { date: '2026-09-07', userProgramSplitId: 'pm-split' })

    const calledSplits: string[] = []
    const result = await drainPendingFinishesOnce('user-a', {
      fetchFinish: async (body) => { calledSplits.push(body.userProgramSplitId); return { ok: true, status: 200 } },
    })

    expect(calledSplits).toEqual(['am-split', 'pm-split'])
    expect(result.remaining).toBe(0)
  })
})

describe('drainPendingFinishes (reentrancy guard)', () => {
  it('two overlapping drain calls for the same user only hit the network once', async () => {
    enqueuePendingFinish('user-a', { date: '2026-09-07', userProgramSplitId: 'split-1' })

    let fetchCalls = 0
    const deps = {
      fetchFinish: async () => {
        fetchCalls += 1
        await new Promise(resolve => setTimeout(resolve, 10))
        return { ok: true, status: 200 }
      },
    }

    const [first, second] = await Promise.all([
      drainPendingFinishes('user-a', deps),
      drainPendingFinishes('user-a', deps),
    ])

    expect(fetchCalls).toBe(1)
    const results = [first, second]
    expect(results.filter(r => r === null)).toHaveLength(1)
    expect(results.filter(r => r !== null)).toHaveLength(1)
    expect(readPendingFinishes('user-a')).toEqual([])
  })

  it('the guard is independent of the write-outbox guard (a finish-drain and a write-drain for the same user never block each other)', async () => {
    enqueuePendingFinish('user-a', { date: '2026-09-07', userProgramSplitId: 'split-1' })
    const result = await drainPendingFinishes('user-a', {
      fetchFinish: async () => ({ ok: true, status: 200 }),
    })
    expect(result).not.toBeNull()
    expect(result!.remaining).toBe(0)
  })
})
