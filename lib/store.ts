export interface SetLog {
  weight: number
  reps: number
  completed: boolean
  skipped?: boolean
  /** Phase 1/2/3 joint contract (sets.rir): integer 0-5+, null/undefined =
   *  not logged — the coaching engine infers from rep-range position
   *  instead. Optional, never required to complete a set. */
  rir?: number | null
}

export interface ExerciseLog {
  exerciseName: string
  canonicalName: string
  backupName: string | null
  sets: SetLog[]
  notes?: string
  isCustom?: boolean  // true for mid-workout quick-adds not in exercises.json
}

// Keyed by `exerciseName:setNumber` (1-indexed), e.g. "Wide-grip Barbell Bench Press:1"
export type SavedSnapshot = Record<string, {
  pageId: string
  weight: number
  reps: number
  notes: string
  rir?: number | null
}>
