// Persists active session to localStorage so the app can detect
// an unfinished session on reopen (same day).

import { Split } from './routines'
import { ExerciseLog, SavedSnapshot } from './store'

const KEY = 'gym_coach_session'

export interface PersistedSession {
  date: string          // ISO date string YYYY-MM-DD
  split: Split
  exIdx: number
  logs: ExerciseLog[]
  snapshot: SavedSnapshot
}

export function saveSessionToStorage(session: PersistedSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Storage full or unavailable — ignore
  }
}

export function loadSessionFromStorage(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed: PersistedSession = JSON.parse(raw)
    // Only return if it's from today
    const today = new Date().toISOString().split('T')[0]
    if (parsed.date !== today) {
      localStorage.removeItem(KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearSessionFromStorage(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
