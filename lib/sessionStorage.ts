// Persists active session to localStorage so the app can detect
// an unfinished session on reopen. Keyed by userId so a shared
// browser does not surface user A's in-progress workout to user B.
//
// Also hosts the offline-finish outbox (GYM-49): when the user taps Finish
// while offline, the payload that would have POSTed to /api/session/write is
// queued here and drained on reconnect or next app boot.

import { Split } from './routines'
import { ExerciseLog, SavedSnapshot } from './store'

const BASE_KEY = 'gym_coach_session'
const OUTBOX_KEY = 'gym_coach_outbox'
const keyFor = (userId: string) => `${BASE_KEY}:${userId}`
const outboxKeyFor = (userId: string) => `${OUTBOX_KEY}:${userId}`

export interface PersistedSession {
  date: string          // ISO date string YYYY-MM-DD
  split: Split
  exIdx: number
  logs: ExerciseLog[]
  snapshot: SavedSnapshot
  startedAt?: string    // ISO timestamp captured when BEGIN WORKOUT was clicked
}

export function saveSessionToStorage(userId: string, session: PersistedSession): void {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(session))
  } catch {
    // Storage full or unavailable — ignore
  }
}

export function loadSessionFromStorage(userId: string): PersistedSession | null {
  // No TTL: a stored in-progress session survives across days. The Resume
  // prompt is opt-in (user must tap Resume) and shows when the session was
  // started, so an old session is obvious. Silently discarding here would
  // be the exact data-loss path GYM-49 exists to prevent.
  try {
    const raw = localStorage.getItem(keyFor(userId))
    if (!raw) return null
    return JSON.parse(raw) as PersistedSession
  } catch {
    return null
  }
}

export function clearSessionFromStorage(userId: string): void {
  try {
    localStorage.removeItem(keyFor(userId))
  } catch {
    // ignore
  }
}

// ── Offline finish-session outbox (GYM-49) ───────────────────────────────────
//
// When the device is offline at "Finish session", the payload to
// /api/session/write is queued here. Drained on `window.online` and on app
// boot in app/page.tsx.

export interface OutboxEntry {
  id: string                      // client-generated, for idempotent removal
  queuedAt: string                // ISO timestamp
  body: {
    entries: unknown[]
    startedAt?: string
  }
}

export function readOutbox(userId: string): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(outboxKeyFor(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeOutbox(userId: string, entries: OutboxEntry[]): void {
  try {
    localStorage.setItem(outboxKeyFor(userId), JSON.stringify(entries))
  } catch {
    // Quota or unavailable — caller can't safely recover; leave existing
    // outbox state intact rather than overwriting with a corrupted partial.
  }
}

export function enqueueOutbox(userId: string, body: OutboxEntry['body']): OutboxEntry {
  const entry: OutboxEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
    body,
  }
  const current = readOutbox(userId)
  writeOutbox(userId, [...current, entry])
  return entry
}

export function removeFromOutbox(userId: string, id: string): void {
  const current = readOutbox(userId)
  writeOutbox(userId, current.filter(e => e.id !== id))
}
