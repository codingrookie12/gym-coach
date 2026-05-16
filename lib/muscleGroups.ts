import type { Muscle } from '@/lib/exerciseLibrary'

// Lifters think in coarse anatomical regions, not 17 named muscles.
// Map every Muscle to one of six top-level groups for navigation + balance views.

export type MuscleGroup = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Core'

export const MUSCLE_GROUPS: MuscleGroup[] = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core']

const MAP: Record<Muscle, MuscleGroup> = {
  Chest: 'Chest',
  Lats: 'Back',
  'Middle Back': 'Back',
  'Lower Back': 'Back',
  Traps: 'Back',
  Neck: 'Back',
  Shoulders: 'Shoulders',
  Biceps: 'Arms',
  Triceps: 'Arms',
  Forearms: 'Arms',
  Quadriceps: 'Legs',
  Hamstrings: 'Legs',
  Glutes: 'Legs',
  Calves: 'Legs',
  Abductors: 'Legs',
  Adductors: 'Legs',
  Abdominals: 'Core',
}

export function muscleToGroup(m: Muscle): MuscleGroup {
  return MAP[m]
}

// Weekly working-set targets per group (hypertrophy literature: 10-20 sets/wk
// per muscle is the bulk of the response curve; below 10 = under-recovered,
// above 22 = diminishing returns / fatigue risk). Tuned conservatively.
export const TARGET_SETS: Record<MuscleGroup, [number, number]> = {
  Chest: [10, 20],
  Back: [10, 20],
  Shoulders: [8, 16],
  Arms: [8, 18],
  Legs: [10, 20],
  Core: [4, 12],
}
