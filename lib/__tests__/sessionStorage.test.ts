/**
 * GYM-49 offline-finish outbox — persistence primitives.
 *
 * vitest runs with `environment: 'node'` (see vitest.config.ts), which has
 * no global `localStorage`, so this installs a minimal in-memory Storage
 * polyfill before each test. No prior test in this repo has exercised
 * lib/sessionStorage.ts's real localStorage calls (grep confirms the only
 * other "localStorage" hit outside this file is in a comment).
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

import {
  saveSessionToStorage,
  loadSessionFromStorage,
  clearSessionFromStorage,
  readOutbox,
  enqueueOutbox,
  removeFromOutbox,
  type PersistedSession,
} from '../sessionStorage'

function makeSession(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    date: '2026-09-01',
    split: 'Push',
    exIdx: 0,
    logs: [],
    snapshot: {},
    ...overrides,
  }
}

describe('session persistence (per-user keyed)', () => {
  it('round-trips a saved session for the correct user', () => {
    saveSessionToStorage('user-a', makeSession())
    expect(loadSessionFromStorage('user-a')).toEqual(makeSession())
  })

  it('keeps user A and user B sessions isolated on a shared device', () => {
    saveSessionToStorage('user-a', makeSession({ split: 'Push' }))
    saveSessionToStorage('user-b', makeSession({ split: 'Pull' }))
    expect(loadSessionFromStorage('user-a')?.split).toBe('Push')
    expect(loadSessionFromStorage('user-b')?.split).toBe('Pull')
  })

  it('returns null when nothing is stored', () => {
    expect(loadSessionFromStorage('nobody')).toBeNull()
  })

  it('clears only the targeted user', () => {
    saveSessionToStorage('user-a', makeSession())
    saveSessionToStorage('user-b', makeSession())
    clearSessionFromStorage('user-a')
    expect(loadSessionFromStorage('user-a')).toBeNull()
    expect(loadSessionFromStorage('user-b')).not.toBeNull()
  })
})

describe('offline-finish outbox (GYM-49)', () => {
  it('a write attempted while offline is queued, not lost', () => {
    expect(readOutbox('user-a')).toEqual([])
    const entry = enqueueOutbox('user-a', { entries: [{ foo: 'bar' }] })
    const pending = readOutbox('user-a')
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe(entry.id)
    expect(pending[0].body).toEqual({ entries: [{ foo: 'bar' }] })
    expect(pending[0].queuedAt).toBeTruthy()
  })

  it('preserves FIFO order across multiple queued entries', () => {
    enqueueOutbox('user-a', { entries: [{ n: 1 }] })
    enqueueOutbox('user-a', { entries: [{ n: 2 }] })
    enqueueOutbox('user-a', { entries: [{ n: 3 }] })
    const pending = readOutbox('user-a')
    expect(pending.map(e => (e.body.entries[0] as any).n)).toEqual([1, 2, 3])
  })

  it('keeps separate outbox queues per user', () => {
    enqueueOutbox('user-a', { entries: [{ n: 1 }] })
    enqueueOutbox('user-b', { entries: [{ n: 2 }] })
    expect(readOutbox('user-a')).toHaveLength(1)
    expect(readOutbox('user-b')).toHaveLength(1)
  })

  it('removes only the targeted entry by id', () => {
    const e1 = enqueueOutbox('user-a', { entries: [{ n: 1 }] })
    const e2 = enqueueOutbox('user-a', { entries: [{ n: 2 }] })
    removeFromOutbox('user-a', e1.id)
    const remaining = readOutbox('user-a')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(e2.id)
  })

  it('readOutbox tolerates corrupted JSON by returning an empty queue rather than throwing', () => {
    localStorage.setItem('gym_coach_outbox:user-a', '{not valid json')
    expect(readOutbox('user-a')).toEqual([])
  })

  it('carries the optional startedAt through the queued body', () => {
    enqueueOutbox('user-a', { entries: [{ n: 1 }], startedAt: '2026-09-01T10:00:00.000Z' })
    expect(readOutbox('user-a')[0].body.startedAt).toBe('2026-09-01T10:00:00.000Z')
  })
})
