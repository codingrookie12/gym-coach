import { Equipment, Muscle, Split } from './exerciseLibrary'

const BASE_KEY = 'gym_coach_custom_exercises'
const keyFor = (userId: string) => `${BASE_KEY}:${userId}`

export interface PendingExercise {
  name: string
  addedAt: string
  metadataComplete: boolean
  equipment?: Equipment
  primaryMuscles?: Muscle[]
  split?: Split | null
}

export function getPendingExercises(userId: string): PendingExercise[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(keyFor(userId))
    return raw ? (JSON.parse(raw) as PendingExercise[]) : []
  } catch {
    return []
  }
}

export function savePendingExercise(userId: string, name: string): void {
  const all = getPendingExercises(userId)
  if (all.some(e => e.name.toLowerCase() === name.toLowerCase())) return
  all.push({ name, addedAt: new Date().toISOString(), metadataComplete: false })
  localStorage.setItem(keyFor(userId), JSON.stringify(all))
}

export function completeExerciseMetadata(
  userId: string,
  name: string,
  metadata: { equipment: Equipment; primaryMuscles: Muscle[]; split: Split | null }
): void {
  const all = getPendingExercises(userId).map(e =>
    e.name.toLowerCase() === name.toLowerCase()
      ? { ...e, ...metadata, metadataComplete: true }
      : e
  )
  localStorage.setItem(keyFor(userId), JSON.stringify(all))
}

export function getIncompletePendingExercises(userId: string): PendingExercise[] {
  return getPendingExercises(userId).filter(e => !e.metadataComplete)
}
