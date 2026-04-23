import { Equipment, Muscle, Split } from './exerciseLibrary'

const STORAGE_KEY = 'gym_coach_custom_exercises'

export interface PendingExercise {
  name: string
  addedAt: string
  metadataComplete: boolean
  equipment?: Equipment
  primaryMuscles?: Muscle[]
  split?: Split | null
}

export function getPendingExercises(): PendingExercise[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PendingExercise[]) : []
  } catch {
    return []
  }
}

export function savePendingExercise(name: string): void {
  const all = getPendingExercises()
  if (all.some(e => e.name.toLowerCase() === name.toLowerCase())) return
  all.push({ name, addedAt: new Date().toISOString(), metadataComplete: false })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function completeExerciseMetadata(
  name: string,
  metadata: { equipment: Equipment; primaryMuscles: Muscle[]; split: Split | null }
): void {
  const all = getPendingExercises().map(e =>
    e.name.toLowerCase() === name.toLowerCase()
      ? { ...e, ...metadata, metadataComplete: true }
      : e
  )
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function getIncompletePendingExercises(): PendingExercise[] {
  return getPendingExercises().filter(e => !e.metadataComplete)
}
