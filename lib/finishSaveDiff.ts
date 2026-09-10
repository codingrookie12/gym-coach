import { ExerciseLog, SavedSnapshot, SetLog } from './store'
import { AutosavePatchEntry } from './autosavePlan'

/**
 * Finish-time (app/page.tsx's handleSaveSession) equivalent of the per-set
 * patch-vs-noop decision lib/autosavePlan.ts's planAutosave runs for the
 * mid-session autosave path. handleSaveSession keeps its own independent
 * copy of the surrounding insert/patch partitioning (its insert branch
 * resolves the routine-default unit via `appState.plan`, which planAutosave
 * doesn't do) — but the "did anything about this already-saved set change
 * since it was last saved" comparison is identical logic, so it's extracted
 * here as its own small pure function to keep the two copies from drifting
 * and to make it directly testable (handleSaveSession itself is not — it's
 * an inline closure inside a large stateful client component).
 *
 * Mirrors planAutosave's instanceChanged fix (929a5bc): equipmentInstanceId
 * is compared against the snapshot the same way weight/reps/notes/rir are,
 * with undefined/null both normalized to null so an untagged set never
 * false-positives a change.
 *
 * Returns `null` when nothing changed (correctly a no-op — must never
 * produce an empty PATCH body), otherwise the changes to send.
 */
export function computeFinishSaveChanges(
  set: SetLog,
  exLog: ExerciseLog,
  prior: SavedSnapshot[string]
): AutosavePatchEntry['changes'] | null {
  const weightChanged = set.weight !== prior.weight
  const repsChanged = set.reps !== prior.reps
  const notesChanged = (exLog.notes ?? '') !== prior.notes
  const rirChanged = (set.rir ?? null) !== (prior.rir ?? null)
  const currentInstanceId = exLog.equipmentInstanceId ?? null
  const instanceChanged = currentInstanceId !== (prior.equipmentInstanceId ?? null)

  if (!weightChanged && !repsChanged && !notesChanged && !rirChanged && !instanceChanged) return null

  const changes: AutosavePatchEntry['changes'] = {}
  if (weightChanged) changes.weight = set.weight
  if (repsChanged) changes.reps = set.reps
  if (notesChanged) changes.notes = exLog.notes ?? ''
  if (rirChanged) changes.rir = set.rir ?? null
  if (instanceChanged) changes.equipmentInstanceId = currentInstanceId
  return changes
}
