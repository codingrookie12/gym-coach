// Drains the offline-finish outbox (GYM-49, see lib/sessionStorage.ts) — the
// queue of /api/session/write payloads that couldn't be sent while offline.
// Extracted out of app/page.tsx so this has direct test coverage: this repo
// has no jsdom/RTL harness (see tests/login-otp-input.test.ts's docstring),
// so logic that stayed as an inline closure on the page component couldn't
// be exercised at all.
//
// Concurrency note (bug found + fixed during the GYM test-coverage pass that
// added this file): app/page.tsx calls the drain from two independent
// triggers — the mount-time `detect()` flow, and a `useEffect` on
// `useOnlineStatus()`'s `online` flag. `online` is already `true` on mount
// in the common case (it initializes from `navigator.onLine`, not from a
// genuine offline→online transition), so both triggers can fire within the
// same tick whenever a user reopens the app online with a non-empty outbox.
// The previous inline implementation had no reentrancy guard, so both
// triggers would call `readOutbox()` before either had removed anything and
// both POST the same queued entries to `/api/session/write` concurrently.
// That route's own duplicate guard is a SELECT-then-insert on
// (workout_id, exercise_id, set_number) — explicitly documented there as
// "not fully race-proof against true concurrent writers" — so two
// simultaneous drains of the same entry could each pass the "no existing
// row" check before either commits its insert, producing a genuine
// duplicate `sets` row. `drainOutbox` below guards against this at the
// source with a module-level in-flight set, keyed by userId.

import { OutboxEntry, readOutbox, removeFromOutbox } from './sessionStorage'

export interface DrainDeps {
  /** Abstracts the POST to /api/session/write so this is testable without a
   *  real network/fetch. Return shape mirrors the parts of a Response this
   *  logic actually branches on. */
  fetchWrite: (body: OutboxEntry['body']) => Promise<{ ok: boolean; status: number }>
}

export interface DrainResult {
  drainedIds: string[]
  droppedIds: string[]
  remaining: number
}

/**
 * Drain the outbox for one user, sequentially. One entry's round trip
 * completes before the next starts — both so ordering (oldest-queued-first)
 * is preserved, and so this process's own calls never race each other over
 * the same entry (the cross-trigger race is what `drainOutbox` below guards
 * against separately).
 *
 * - 2xx: entry persisted — removed from the outbox.
 * - 4xx: malformed payload — dropped to avoid an infinite retry loop.
 * - 5xx: left queued, but draining continues to the next entry (a single
 *   entry's server error shouldn't block ones after it).
 * - network error (fetch throws): stop entirely — every entry from this
 *   point on stays queued for the next drain attempt, since a network
 *   failure on one entry means the rest will fail the same way right now.
 */
export async function drainOutboxOnce(userId: string, deps: DrainDeps): Promise<DrainResult> {
  const pending = readOutbox(userId)
  const drainedIds: string[] = []
  const droppedIds: string[] = []

  for (const entry of pending) {
    let res: { ok: boolean; status: number }
    try {
      res = await deps.fetchWrite(entry.body)
    } catch {
      break
    }

    if (res.ok) {
      removeFromOutbox(userId, entry.id)
      drainedIds.push(entry.id)
    } else if (res.status >= 400 && res.status < 500) {
      removeFromOutbox(userId, entry.id)
      droppedIds.push(entry.id)
    }
    // 5xx: leave queued, fall through to the next entry.
  }

  return { drainedIds, droppedIds, remaining: readOutbox(userId).length }
}

const draining = new Set<string>()

/**
 * Reentrancy-guarded entry point — the one app/page.tsx should call. Returns
 * `null` (does nothing) if a drain for this userId is already in flight.
 */
export async function drainOutbox(userId: string, deps: DrainDeps): Promise<DrainResult | null> {
  if (draining.has(userId)) return null
  draining.add(userId)
  try {
    return await drainOutboxOnce(userId, deps)
  } finally {
    draining.delete(userId)
  }
}

/** Test-only escape hatch to reset the module-level guard between cases. */
export function __resetDrainGuardForTests(): void {
  draining.clear()
}
