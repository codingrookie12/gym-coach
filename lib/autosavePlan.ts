import { ExerciseLog, SavedSnapshot } from '@/lib/store'

export interface AutosaveWriteEntry {
  exercise: string
  date: string
  split: string
  weight: number
  set: number
  reps: number
  entry: string
  notes?: string
  unit: 'Lbs' | 'Pins'
  rir?: number
  userProgramSplitId?: string
}

export interface AutosavePatchEntry {
  pageId: string
  /** `${exerciseName}:${setNumber}` — the SavedSnapshot key this patch belongs to. */
  key: string
  changes: { weight?: number; reps?: number; notes?: string; rir?: number | null }
  /** Fully-resolved current values, to cache back into the snapshot once the patch succeeds. */
  resolved: { weight: number; reps: number; notes: string; rir: number | null }
}

export interface AutosavePlan {
  toInsert: AutosaveWriteEntry[]
  /** 1-indexed set numbers, aligned index-for-index with `toInsert`. */
  insertSetNumbers: number[]
  toPatch: AutosavePatchEntry[]
}

/**
 * Snapshot-aware partition of an exercise's completed sets into brand-new
 * inserts vs. patches to a set a previous autosave already persisted.
 *
 * Ports the patch-vs-insert logic app/page.tsx's `handleSaveSession` has run
 * against `SavedSnapshot` since GYM-97. Before this existed,
 * ActiveSessionScreen's autosave effect always built a raw insert list for
 * every *currently* completed set, with no memory of which sets a previous
 * autosave call already wrote. Combined with `selectRir()`/`updateNotes()`
 * intentionally re-arming `savedExIndices` so a late RIR/notes edit can
 * "re-save" the exercise, the normal weight→reps→RIR entry order on any
 * exercise's last set (`completed` flips true before RIR is entered)
 * triggered a second autosave pass that reinserted every set in the
 * exercise a second time — duplicated, with the first copies left stale.
 *
 * A set with a snapshot entry is never re-inserted here, only patched — and
 * only when something about it actually changed since it was last saved.
 */
export function planAutosave(
  ex: ExerciseLog,
  opts: { date: string; split: string; weightUnit: 'Lbs' | 'Pins'; userProgramSplitId?: string },
  snapshot: SavedSnapshot
): AutosavePlan {
  const toInsert: AutosaveWriteEntry[] = []
  const insertSetNumbers: number[] = []
  const toPatch: AutosavePatchEntry[] = []

  for (let si = 0; si < ex.sets.length; si++) {
    const set = ex.sets[si]
    if (!set.completed) continue
    const setNumber = si + 1
    const key = `${ex.exerciseName}:${setNumber}`
    const prior = snapshot[key]

    if (prior) {
      const weightChanged = set.weight !== prior.weight
      const repsChanged = set.reps !== prior.reps
      const notesChanged = (ex.notes ?? '') !== prior.notes
      const rirChanged = (set.rir ?? null) !== (prior.rir ?? null)
      if (!weightChanged && !repsChanged && !notesChanged && !rirChanged) continue

      const changes: AutosavePatchEntry['changes'] = {}
      if (weightChanged) changes.weight = set.weight
      if (repsChanged) changes.reps = set.reps
      if (notesChanged) changes.notes = ex.notes ?? ''
      if (rirChanged) changes.rir = set.rir ?? null

      toPatch.push({
        pageId: prior.pageId,
        key,
        changes,
        resolved: { weight: set.weight, reps: set.reps, notes: ex.notes ?? '', rir: set.rir ?? null },
      })
      continue
    }

    toInsert.push({
      exercise: ex.exerciseName,
      date: opts.date,
      split: opts.split,
      weight: set.weight,
      set: setNumber,
      reps: set.reps,
      entry: `${ex.exerciseName} — Set ${setNumber}`,
      notes: ex.notes || undefined,
      unit: opts.weightUnit,
      rir: set.rir ?? undefined,
      userProgramSplitId: opts.userProgramSplitId,
    })
    insertSetNumbers.push(setNumber)
  }

  return { toInsert, insertSetNumbers, toPatch }
}
