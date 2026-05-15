// Persists active session to localStorage so the app can detect
// an unfinished session on reopen (same day). Keyed by userId so a shared
// browser does not surface user A's in-progress workout to user B.

import { Split } from './routines'
import { ExerciseLog, SavedSnapshot } from './store'

const BASE_KEY = 'gym_coach_session'
const keyFor = (userId: string) => `${BASE_KEY}:${userId}`

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
  try {
    const raw = localStorage.getItem(keyFor(userId))
    if (!raw) return null
    const parsed: PersistedSession = JSON.parse(raw)
    const today = new Date().toISOString().split('T')[0]
    if (parsed.date !== today) {
      localStorage.removeItem(keyFor(userId))
      return null
    }
    return parsed
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
