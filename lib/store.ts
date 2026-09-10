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
  /** Already-resolved persisted-form unit ('Lbs'|'Kg'|'Pins') for this
   *  exercise's sets in THIS session — set by ActiveSessionScreen's
   *  kg/lbs toggle (lib/setUnit.ts's resolvePersistedUnit) so the unit
   *  travels with the log through onFinish/handleSaveSession the same way
   *  weight/reps/rir do, instead of being re-derived from the static routine
   *  default at save time (which would silently ignore an in-session
   *  toggle — the exact "relabel-without-converting" bug class
   *  lib/weightConversion.ts's header warns about). Undefined = no
   *  in-session override yet; callers fall back to the routine's static
   *  weightUnit exactly as they did before this field existed. */
  unit?: 'Lbs' | 'Kg' | 'Pins'
  /** Equipment instance (lib/equipmentInstances.ts) selected for this
   *  exercise THIS session — e.g. which specific pin-stack machine. Session-
   *  scoped only (not yet persisted as a routine-level default — see
   *  components/EquipmentInstanceSheet.tsx's docstring). Undefined/null =
   *  untagged, identical to today's behavior. */
  equipmentInstanceId?: string | null
}

// Keyed by `exerciseName:setNumber` (1-indexed), e.g. "Wide-grip Barbell Bench Press:1"
export type SavedSnapshot = Record<string, {
  pageId: string
  weight: number
  reps: number
  notes: string
  rir?: number | null
}>
