// Persists exercise availability state to localStorage.
// An exercise absent from this map is considered available (default true).
// Phase 1 migration: swap internals to Supabase user_exercise_availability table;
// all callers remain unchanged.

const KEY = 'gym_coach_exercise_availability'

export function getExerciseAvailability(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, boolean>
  } catch {
    return {}
  }
}

export function setExerciseAvailable(exerciseName: string, available: boolean): void {
  try {
    const current = getExerciseAvailability()
    if (available) {
      delete current[exerciseName]
    } else {
      current[exerciseName] = false
    }
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // Storage full or unavailable — ignore
  }
}

export function resetExerciseAvailability(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function getUnavailableExercises(availability: Record<string, boolean>): string[] {
  return Object.entries(availability)
    .filter(([, available]) => !available)
    .map(([name]) => name)
}
