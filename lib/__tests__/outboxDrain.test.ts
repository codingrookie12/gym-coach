/**
 * GYM-49 offline-finish outbox — drain-on-reconnect logic, extracted from
 * app/page.tsx into lib/outboxDrain.ts specifically so it could be tested
 * (this repo has no jsdom/RTL harness to exercise a component's closures).
 *
 * Covers: queued entries actually drain (persist) on success, a
 * partial-failure mid-drain doesn't lose or duplicate data, and — the
 * concurrency bug found while writing these tests (see outboxDrain.ts's
 * docstring) — two overlapping drain calls for the same user never both hit
 * the network for the same entry.
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

import { enqueueOutbox, readOutbox } from '../sessionStorage'
import { drainOutboxOnce, drainOutbox, __resetDrainGuardForTests } from '../outboxDrain'

beforeEach(() => {
  __resetDrainGuardForTests()
})

describe('drainOutboxOnce', () => {
  it('reconnect drains the queue and persists every entry (removes it from the outbox on 2xx)', async () => {
    enqueueOutbox('user-a', { entries: [{ n: 1 }] })
    enqueueOutbox('user-a', { entries: [{ n: 2 }] })

    const calls: unknown[] = []
    const result = await drainOutboxOnce('user-a', {
      fetchWrite: async (body) => { calls.push(body); return { ok: true, status: 200 } },
    })

    expect(calls).toHaveLength(2)
    expect(result.drainedIds).toHaveLength(2)
    expect(result.remaining).toBe(0)
    expect(readOutbox('user-a')).toEqual([])
  })

  it('a network error mid-drain leaves that entry AND every entry after it queued — no data loss', async () => {
    enqueueOutbox('user-a', { entries: [{ n: 1 }] })
    enqueueOutbox('user-a', { entries: [{ n: 2 }] })
    enqueueOutbox('user-a', { entries: [{ n: 3 }] })

    let call = 0
    const result = await drainOutboxOnce('user-a', {
      fetchWrite: async () => {
        call += 1
        if (call === 2) throw new Error('network down')
        return { ok: true, status: 200 }
      },
    })

    // First entry drained before the failure; the failing entry and the one
    // after it are never attempted and stay queued for the next drain.
    expect(result.drainedIds).toHaveLength(1)
    expect(result.remaining).toBe(2)
    expect(readOutbox('user-a').map(e => (e.body.entries[0] as any).n)).toEqual([2, 3])
  })

  it('a 5xx leaves the entry queued but does not block later entries in the same batch', async () => {
    enqueueOutbox('user-a', { entries: [{ n: 1 }] })
    enqueueOutbox('user-a', { entries: [{ n: 2 }] })

    let call = 0
    const result = await drainOutboxOnce('user-a', {
      fetchWrite: async () => {
        call += 1
        return call === 1 ? { ok: false, status: 500 } : { ok: true, status: 200 }
      },
    })

    expect(result.drainedIds).toHaveLength(1)
    expect(result.remaining).toBe(1)
    expect(readOutbox('user-a').map(e => (e.body.entries[0] as any).n)).toEqual([1])
  })

  it('a 4xx (malformed payload) is dropped permanently rather than retried forever', async () => {
    enqueueOutbox('user-a', { entries: [{ n: 1 }] })

    const result = await drainOutboxOnce('user-a', {
      fetchWrite: async () => ({ ok: false, status: 400 }),
    })

    expect(result.droppedIds).toHaveLength(1)
    expect(result.remaining).toBe(0)
    expect(readOutbox('user-a')).toEqual([])
  })

  it('an empty outbox is a no-op — never calls the network', async () => {
    let called = false
    const result = await drainOutboxOnce('user-a', {
      fetchWrite: async () => { called = true; return { ok: true, status: 200 } },
    })
    expect(called).toBe(false)
    expect(result.remaining).toBe(0)
  })
})

describe('drainOutbox (reentrancy guard)', () => {
  it('BUG FOUND + FIXED: two overlapping drain calls for the same user only hit the network once', async () => {
    // app/page.tsx triggers a drain from two independent effects (mount
    // detect() and the online-status effect) that can both fire in the same
    // tick when the app opens online with a pending outbox. Before this
    // guard existed, both calls would read the same pending entries and
    // both POST them to /api/session/write concurrently — a real risk given
    // that route's duplicate guard is a non-atomic SELECT-then-insert (see
    // app/api/session/write/route.ts's own comment on that guard).
    enqueueOutbox('user-a', { entries: [{ n: 1 }] })

    let fetchCalls = 0
    const deps = {
      fetchWrite: async (body: unknown) => {
        fetchCalls += 1
        await new Promise(resolve => setTimeout(resolve, 10))
        return { ok: true, status: 200 }
      },
    }

    const [first, second] = await Promise.all([
      drainOutbox('user-a', deps),
      drainOutbox('user-a', deps),
    ])

    // Exactly one of the two calls actually ran the drain; the other was a
    // no-op guarded out.
    expect(fetchCalls).toBe(1)
    const results = [first, second]
    expect(results.filter(r => r === null)).toHaveLength(1)
    expect(results.filter(r => r !== null)).toHaveLength(1)
    expect(readOutbox('user-a')).toEqual([])
  })

  it('the guard releases after completion, so a later drain for the same user runs normally', async () => {
    enqueueOutbox('user-a', { entries: [{ n: 1 }] })
    await drainOutbox('user-a', { fetchWrite: async () => ({ ok: true, status: 200 }) })

    enqueueOutbox('user-a', { entries: [{ n: 2 }] })
    let secondRunCalls = 0
    const result = await drainOutbox('user-a', {
      fetchWrite: async () => { secondRunCalls += 1; return { ok: true, status: 200 } },
    })

    expect(secondRunCalls).toBe(1)
    expect(result).not.toBeNull()
    expect(result!.remaining).toBe(0)
  })

  it('guards independently per user — user B is never blocked by user A draining', async () => {
    enqueueOutbox('user-a', { entries: [{ n: 1 }] })
    enqueueOutbox('user-b', { entries: [{ n: 2 }] })

    let aCalls = 0
    let bCalls = 0
    const [, bResult] = await Promise.all([
      drainOutbox('user-a', {
        fetchWrite: async () => { aCalls += 1; await new Promise(r => setTimeout(r, 10)); return { ok: true, status: 200 } },
      }),
      drainOutbox('user-b', {
        fetchWrite: async () => { bCalls += 1; return { ok: true, status: 200 } },
      }),
    ])

    expect(aCalls).toBe(1)
    expect(bCalls).toBe(1)
    expect(bResult).not.toBeNull()
  })
})
