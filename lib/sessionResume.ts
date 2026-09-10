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
import { PersistedSession } from './sessionStorage'

export interface DbResumeSet {
  setNumber: number
  weight: number
  reps: number
  notes: string
  rir: number | null
  pageId: string
  /** DB's own `sets.unit` ('Lbs'|'Kg'|'Pins') for this row, when the caller
   *  selected it (GET /api/session/today/details does). Reconstructed onto
   *  the rebuilt ExerciseLog's `unit` field below — without this, a session
   *  toggled to kg before localStorage was lost would resume relabeled as
   *  Lbs while still holding real kg numbers (see lib/store.ts's
   *  ExerciseLog.unit docstring). Optional/undefined for any caller that
   *  hasn't been updated to select it — same fallback-to-routine-default
   *  behavior as before this field existed. */
  unit?: 'Lbs' | 'Kg' | 'Pins' | null
  /** DB's own `sets.equipment_instance_id` for this row, when the caller
   *  selected it (GET /api/session/today/details does, once the equipment-
   *  instance migration — supabase/migrations/20260909000000_equipment_
   *  model.sql — has actually been applied; see that route for the
   *  column-may-not-exist-yet guard). Reconstructed onto the rebuilt
   *  ExerciseLog's `equipmentInstanceId` field the same way `unit` is
   *  above — without this, an instance tagged before localStorage was lost
   *  would resume untagged. Optional/undefined for any caller that hasn't
   *  selected the column (including pre-migration, when it can't exist) —
   *  same fallback-to-untagged behavior as before this field existed. */
  equipmentInstanceId?: string | null
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
      // Keyed by display name (item.exercise.name), not canonicalName — this
      // must match ActiveSessionScreen's autosave effect
      // (`${ex.exerciseName}:${setIndices[i]}`) and app/page.tsx's
      // handleSaveSession (`${exLog.exerciseName}:${si + 1}`), the two other
      // writers of this same SavedSnapshot map. For any exercise where the
      // display name differs from its canonicalName (e.g. lib/routines.ts's
      // { name: 'Hack Squat', canonicalName: 'Linear Hack Press' }), keying
      // by canonicalName here produced a snapshot entry under a key none of
      // the other paths ever look up — silently orphaned, and re-visiting
      // that already-completed exercise after a DB-fallback resume could
      // re-insert a duplicate `sets` row (no dedup guard in the write route).
      snapshot[`${item.exercise.name}:${setNumber}`] = {
        pageId: dbSet.pageId,
        weight: dbSet.weight,
        reps: dbSet.reps,
        notes: dbSet.notes,
        rir: dbSet.rir,
        // Conditional, like `unit` below — omit the key entirely (rather
        // than always writing null) so a caller that hasn't selected the
        // column yet (every environment pre-migration) produces the exact
        // same snapshot shape as before this field existed.
        ...(dbSet.equipmentInstanceId ? { equipmentInstanceId: dbSet.equipmentInstanceId } : {}),
      }
      return { weight: dbSet.weight, reps: dbSet.reps, completed: true, skipped: false, rir: dbSet.rir }
    })

    // Any set's unit works as the exercise-wide value — a single exercise
    // never mixes units within one session in practice (toggleMassUnit
    // converts every set in the exercise together). Undefined `unit` on
    // every set (a caller that hasn't started selecting the column yet)
    // correctly falls through to `undefined` here, matching pre-existing
    // behavior exactly (ActiveSessionScreen/app/page.tsx already fall back
    // to the routine's static default whenever ExerciseLog.unit is unset).
    const resumedUnit = dbEx.sets.find(s => s.unit)?.unit ?? undefined

    // Same one-value-represents-the-exercise reasoning as resumedUnit above:
    // equipmentInstanceId is exercise-scoped (lib/store.ts's
    // ExerciseLog.equipmentInstanceId), not per-set, and a single exercise
    // never mixes instances within one session (handleSelectInstance sets it
    // for the whole exercise at once). Undefined on every set (no caller
    // selecting the column yet — true for every environment before the
    // equipment-instance migration is applied) correctly falls through to
    // undefined here, identical to pre-existing (untagged) behavior.
    const resumedInstanceId = dbEx.sets.find(s => s.equipmentInstanceId)?.equipmentInstanceId ?? undefined

    return {
      exerciseName: item.exercise.name,
      canonicalName,
      backupName: item.exercise.backup,
      sets,
      notes: dbEx.sets.find(s => s.notes)?.notes ?? '',
      ...(resumedUnit ? { unit: resumedUnit } : {}),
      ...(resumedInstanceId ? { equipmentInstanceId: resumedInstanceId } : {}),
    }
  })

  const exIdx = firstIncompleteIdx === -1 ? Math.max(0, plan.length - 1) : firstIncompleteIdx

  return { logs, exIdx, snapshot }
}

// ── Resume-prompt trigger (should we show ResumePromptScreen at all?) ──────
//
// This is the decision logic from app/page.tsx's mount-time `detect()`,
// extracted so it has direct test coverage — separate from
// buildResumeStateFromDb above, which only reconstructs the *data* once the
// DB-fallback path has already been decided to fire. Two independent
// signals, checked in order (local first, since it's free — no network
// round trip — and carries full per-set data the DB fallback can't):
//
//   1. localStorage (`PersistedSession`) — only present for a genuinely
//      unfinished session: app/page.tsx's handleSaveSession calls
//      clearSessionFromStorage() on every Finish path (confirmed sync,
//      partial sync, AND offline-queued), so a completed session never
//      lingers here to be mistakenly offered as "resume".
//   2. DB fallback (GYM-98, `/api/session/today`) — that route itself
//      filters `workouts` on `.is('finished_at', null)`, so a completed
//      workout can never surface here either; a `found: true` response is
//      structurally guaranteed to be an in-progress session.
//
// Both predicates additionally require the stored/found split to still be
// one of the program's currently-active splits — a split that was archived
// or removed since the session was recorded should not resurrect a resume
// prompt for it.

export function shouldResumeFromLocal(
  stored: PersistedSession | null,
  activeSplits: string[]
): boolean {
  return !!stored && activeSplits.includes(stored.split)
}

export interface DbTodayResult {
  found: boolean
  split?: string | null
  userProgramSplitId?: string | null
}

export function shouldResumeFromDb(
  dbToday: DbTodayResult | null | undefined,
  activeSplits: string[]
): boolean {
  return !!dbToday?.found && !!dbToday.split && activeSplits.includes(dbToday.split)
}
