/**
 * exerciseLibrary.ts
 *
 * Single source of truth for exercise definitions.
 * Source: free-exercise-db (public domain) + custom exercises.
 * To add image paths to exercises.json, run: node scripts/gym73-add-exercise-images.mjs
 *
 * NAMING CONVENTION
 * -----------------
 * Format: [Equipment] [Muscle/Movement] [Modifier]
 * Examples: "Barbell Bench Press", "Cable Seated Row (Wide Grip)"
 * Reference: NSCA / ExRx.net nomenclature.
 * To add a new exercise, validate the name against this file first.
 * If a close match exists, use it. If not, follow the format above
 * and add it to the CUSTOM section of the processing script.
 */

import exercisesData from './exercises.json'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Split = 'Push' | 'Pull' | 'Legs'
export type Equipment =
  | 'Barbell'
  | 'Dumbbell'
  | 'Cable'
  | 'Machine'
  | 'EZ Bar'
  | 'Bands'
  | 'Kettlebell'
  | 'Bodyweight'
  | 'Exercise Ball'
  | 'Foam Roll'
  | 'Medicine Ball'
  | 'Other'

export type Muscle =
  | 'Abdominals'
  | 'Abductors'
  | 'Adductors'
  | 'Biceps'
  | 'Calves'
  | 'Chest'
  | 'Forearms'
  | 'Glutes'
  | 'Hamstrings'
  | 'Lats'
  | 'Lower Back'
  | 'Middle Back'
  | 'Neck'
  | 'Quadriceps'
  | 'Shoulders'
  | 'Traps'
  | 'Triceps'

export interface ExerciseDefinition {
  id: string
  name: string
  equipment: Equipment
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  split: Split | null   // null = core/abs/neck, not part of PPL
  mechanic: 'compound' | 'isolation' | null
  force: 'push' | 'pull' | 'static' | null
  level: 'beginner' | 'intermediate' | 'expert'
  instructions: string[]
  isCustom: boolean
  /** CDN-relative image paths — ["FolderName/0.jpg", "FolderName/1.jpg"] (start + end position).
   *  Resolve with: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{path}
   *  2 exercises in the PPL program have no source match and will be undefined. */
  images?: string[]
}

// ─── Dataset ──────────────────────────────────────────────────────────────────

export const ALL_EXERCISES: ExerciseDefinition[] = exercisesData as ExerciseDefinition[]

// ─── Query helpers ────────────────────────────────────────────────────────────

export interface ExerciseFilter {
  query?: string          // text search against name
  split?: Split           // Push | Pull | Legs
  equipment?: Equipment   // filter by equipment type
  muscle?: string         // filter by primary muscle (case-insensitive)
  excludeNames?: string[] // exclude exercises already in session
}

/**
 * Filter the exercise library. All filters are applied simultaneously (AND logic).
 * Results are sorted alphabetically by name.
 */
export function filterExercises(filters: ExerciseFilter): ExerciseDefinition[] {
  const query = filters.query?.toLowerCase().trim()
  const muscle = filters.muscle?.toLowerCase().trim()

  return ALL_EXERCISES.filter(ex => {
    if (filters.split && ex.split !== filters.split) return false
    if (filters.equipment && ex.equipment !== filters.equipment) return false
    if (muscle && !ex.primaryMuscles.some(m => m.toLowerCase().includes(muscle))) return false
    if (filters.excludeNames?.includes(ex.name)) return false
    if (query && !ex.name.toLowerCase().includes(query)) return false
    return true
  })
}

/**
 * Find an exercise by exact name (case-insensitive).
 */
export function findExerciseByName(name: string): ExerciseDefinition | undefined {
  const normalized = name.toLowerCase().trim()
  return ALL_EXERCISES.find(ex => ex.name.toLowerCase() === normalized)
}

/**
 * Get all unique values for a given field — used to populate filter dropdowns.
 */
export function getUniqueEquipment(): Equipment[] {
  return Array.from(new Set(ALL_EXERCISES.map(ex => ex.equipment))).sort() as Equipment[]
}

export function getUniqueMuscles(): string[] {
  const muscles = new Set<string>()
  ALL_EXERCISES.forEach(ex => {
    ex.primaryMuscles.forEach(m => muscles.add(m))
  })
  return Array.from(muscles).sort()
}

export function getUniqueSplits(): Split[] {
  return ['Push', 'Pull', 'Legs']
}

/**
 * Validate a proposed exercise name against the library.
 * Returns exact match, close matches (name contains the query), or empty array.
 */
export function validateExerciseName(name: string): {
  exactMatch: ExerciseDefinition | null
  closeMatches: ExerciseDefinition[]
} {
  const normalized = name.toLowerCase().trim()
  const exactMatch = ALL_EXERCISES.find(ex => ex.name.toLowerCase() === normalized) ?? null
  const closeMatches = exactMatch
    ? []
    : ALL_EXERCISES.filter(ex =>
        ex.name.toLowerCase().includes(normalized) ||
        normalized.includes(ex.name.toLowerCase())
      ).slice(0, 5)

  return { exactMatch, closeMatches }
}

/**
 * Get alternative exercises for a given exercise.
 * Used by the Change Exercise bottom sheet.
 * Rules: same primary muscle, available equipment, not in current session.
 */
export function getAlternatives(
  exercise: ExerciseDefinition,
  options: {
    availableEquipment: Equipment[]
    excludeNames: string[]
    limit?: number
  }
): ExerciseDefinition[] {
  const primaryMuscles = exercise.primaryMuscles.map(m => m.toLowerCase())

  return ALL_EXERCISES.filter(ex => {
    if (ex.name === exercise.name) return false
    if (options.excludeNames.includes(ex.name)) return false
    if (!options.availableEquipment.includes(ex.equipment)) return false
    const exMuscles = ex.primaryMuscles.map(m => m.toLowerCase())
    return exMuscles.some(m => primaryMuscles.includes(m))
  }).slice(0, options.limit ?? 3)
}
