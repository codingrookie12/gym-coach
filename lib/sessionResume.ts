// GYM-XX: Reconstructs resumable session state (ExerciseLog[] + exercise
// index + SavedSnapshot) from the DB-fallback detection path.
//
// Context: session-resume detection has two signals —
//   1. localStorage (`detectedSession`, PersistedSession) — fast, full data,
//      updated on every set.
//   2. DB fallback (`detectedSplit`) — fires when localStorage doesn't have
//      it (fresh device/browser, cleared storage) but Supabase does have an
//      unfinished `workouts` row for today. This signal is DELIBERATELY
//      lossy at the granularity of an in-progress exercise: `sets` rows are
//      only written once an entire exercise's sets are completed/skipped
//      (see ActiveSessionScreen's auto-save effect), so a partially-logged
//      "current" exercise at the moment storage was lost cannot be
//      recovered byte-for-byte. What CAN and MUST be recovered is every
//      already-synced, already-durable completed set — that data must never
//      be presented as if it doesn't exist, and must never be discarded.
//
// This module takes the plan (only known once CoachingContextScreen
// resolves it) plus the raw completed-sets-by-exercise payload from
// GET /api/session/today/details, and produces the same
// { logs, exIdx, snapshot } shape the localStorage path already has as of
// PersistedSession, so ActiveSessionScreen's initialLogs/initialExIdx/
// initialSnapshot props work identically for both paths.

import { SessionExercisePlan } from './sessionPlan'
import { ExerciseLog, SavedSnapshot, SetLog } from './store'

export interface DbResumeSet {
  setNumber: number
  weight: number
  reps: number
  notes: string
  rir: number | null
  pageId: string
}

export interface DbResumeExercise {
  exerciseName: string // canonical name, matches plan[].exercise.canonicalName
  sets: DbResumeSet[]
}

export interface DbResumeData {
  startedAt: string | null
  exercises: DbResumeExercise[]
}

export interface BuiltResumeState {
  logs: ExerciseLog[]
  exIdx: number
  snapshot: SavedSnapshot
}

/**
 * Merge DB-fallback completed-set data onto a freshly-resolved plan.
 *
 * Matching is by canonicalName (not array position) since the plan is
 * recomputed fresh for this resume and DB exercises are only known for
 * whichever ones were actually completed — order isn't guaranteed to line
 * up positionally against a rebuilt plan.
 *
 * exIdx (where the user lands) is the first plan item with NO completed-set
 * data in the DB — i.e. resume right after the last fully-logged exercise.
 * If every plan exercise already has DB data, land on the last one rather
 * than past the end of the plan.
 */
export function buildResumeStateFromDb(
  plan: SessionExercisePlan[],
  dbData: DbResumeExercise[]
): BuiltResumeState {
  const snapshot: SavedSnapshot = {}
  const dbByName = new Map(dbData.map(e => [e.exerciseName, e]))
  let firstIncompleteIdx = -1

  const logs: ExerciseLog[] = plan.map((item, idx) => {
    const canonicalName = item.exercise.canonicalName
    const dbEx = dbByName.get(canonicalName)
    const setCount = Math.max(item.exercise.sets, dbEx?.sets.length ?? 0)

    if (!dbEx) {
      if (firstIncompleteIdx === -1) firstIncompleteIdx = idx
      return {
        exerciseName: item.exercise.name,
        canonicalName,
        backupName: item.exercise.backup,
        sets: Array.from({ length: setCount }, () => ({
          weight: item.targetWeight ?? 0,
          reps: 0,
          completed: false,
          skipped: false,
          rir: null,
        })),
        notes: '',
      }
    }

    const dbSetsByNumber = new Map(dbEx.sets.map(s => [s.setNumber, s]))
    const sets: SetLog[] = Array.from({ length: setCount }, (_, i) => {
      const setNumber = i + 1
      const dbSet = dbSetsByNumber.get(setNumber)
      if (!dbSet) {
        return { weight: item.targetWeight ?? 0, reps: 0, completed: false, skipped: false, rir: null }
      }
      snapshot[`${canonicalName}:${setNumber}`] = {
        pageId: dbSet.pageId,
        weight: dbSet.weight,
        reps: dbSet.reps,
        notes: dbSet.notes,
        rir: dbSet.rir,
      }
      return { weight: dbSet.weight, reps: dbSet.reps, completed: true, skipped: false, rir: dbSet.rir }
    })

    return {
      exerciseName: item.exercise.name,
      canonicalName,
      backupName: item.exercise.backup,
      sets,
      notes: dbEx.sets.find(s => s.notes)?.notes ?? '',
    }
  })

  const exIdx = firstIncompleteIdx === -1 ? Math.max(0, plan.length - 1) : firstIncompleteIdx

  return { logs, exIdx, snapshot }
}
