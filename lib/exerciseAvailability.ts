// Per-user equipment availability — backed by Supabase `exercise_availability`
// (sparse: row present = exercise marked unavailable). RLS enforces user scoping.
// Replaces the old localStorage-only store; cross-user leak on shared devices
// was the reason for the migration.

export interface AvailabilityState {
  unavailable: Set<string>
  trainedEquipment: Set<string>
  trainedExercises: Set<string>
}

export async function fetchAvailability(): Promise<AvailabilityState> {
  try {
    const res = await fetch('/api/availability')
    if (!res.ok) return emptyState()
    const data = await res.json()
    return {
      unavailable: new Set(data.unavailable ?? []),
      trainedEquipment: new Set(data.trainedEquipment ?? []),
      trainedExercises: new Set(data.trainedExercises ?? []),
    }
  } catch {
    return emptyState()
  }
}

export async function setExerciseAvailable(name: string, available: boolean): Promise<void> {
  const res = await fetch('/api/availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exercise: name, available }),
  })
  if (!res.ok) throw new Error(`Failed to update availability (${res.status})`)
}

export async function resetExerciseAvailability(): Promise<void> {
  const res = await fetch('/api/availability', { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to reset availability (${res.status})`)
}

export function emptyAvailability(): AvailabilityState {
  return emptyState()
}

function emptyState(): AvailabilityState {
  return {
    unavailable: new Set(),
    trainedEquipment: new Set(),
    trainedExercises: new Set(),
  }
}
