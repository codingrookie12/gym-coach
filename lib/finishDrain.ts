// Drains the pending-finish queue (see lib/sessionStorage.ts's
// "Pending-finish queue" section for the bug this exists to close) — mirrors
// lib/outboxDrain.ts's structure and semantics exactly, applied to
// /api/session/finish instead of /api/session/write:
//
// - 2xx: finish confirmed — removed from the queue.
// - 4xx: malformed payload (shouldn't happen in practice — the payload is
//   built from values that were valid enough to reach Finish in the first
//   place) — dropped to avoid an infinite retry loop rather than left to
//   retry forever.
// - 5xx: left queued, but draining continues to the next entry.
// - network error (fetch throws): stop entirely — every entry from this
//   point on stays queued for the next drain attempt.
//
// Same reentrancy guard as outboxDrain.ts, keyed independently (a user's
// finish-drain and write-drain never block each other).

import { PendingFinishEntry, readPendingFinishes, removePendingFinish } from './sessionStorage'

export interface FinishDrainDeps {
  /** Abstracts the POST to /api/session/finish so this is testable without a
   *  real network/fetch. Return shape mirrors the parts of a Response this
   *  logic actually branches on. */
  fetchFinish: (body: PendingFinishEntry['body']) => Promise<{ ok: boolean; status: number }>
}

export interface FinishDrainResult {
  drainedIds: string[]
  droppedIds: string[]
  remaining: number
}

export async function drainPendingFinishesOnce(userId: string, deps: FinishDrainDeps): Promise<FinishDrainResult> {
  const pending = readPendingFinishes(userId)
  const drainedIds: string[] = []
  const droppedIds: string[] = []

  for (const entry of pending) {
    let res: { ok: boolean; status: number }
    try {
      res = await deps.fetchFinish(entry.body)
    } catch {
      break
    }

    if (res.ok) {
      removePendingFinish(userId, entry.id)
      drainedIds.push(entry.id)
    } else if (res.status >= 400 && res.status < 500) {
      removePendingFinish(userId, entry.id)
      droppedIds.push(entry.id)
    }
    // 5xx: leave queued, fall through to the next entry.
  }

  return { drainedIds, droppedIds, remaining: readPendingFinishes(userId).length }
}

const draining = new Set<string>()

/**
 * Reentrancy-guarded entry point — the one app/page.tsx should call.
 * Returns `null` (does nothing) if a finish-drain for this userId is
 * already in flight.
 */
export async function drainPendingFinishes(userId: string, deps: FinishDrainDeps): Promise<FinishDrainResult | null> {
  if (draining.has(userId)) return null
  draining.add(userId)
  try {
    return await drainPendingFinishesOnce(userId, deps)
  } finally {
    draining.delete(userId)
  }
}

/** Test-only escape hatch to reset the module-level guard between cases. */
export function __resetFinishDrainGuardForTests(): void {
  draining.clear()
}
