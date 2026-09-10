import type { RoutineExerciseRow } from './userRoutine'

/**
 * GYM-94 deferred-write + Undo controller for CustomProgramBuilderScreen's
 * edit-mode add/remove exercise flows.
 *
 * Extracted out of the screen component (rather than inlined the way
 * RoutineEditorScreen does it) so the commit/undo timing semantics are
 * directly unit-testable without rendering React — this repo has no
 * jsdom/React-Testing-Library setup, and every other stateful-logic module
 * here (lib/finishSaveDiff.ts, lib/autosavePlan.ts) follows the same
 * "extract the pure/orchestration logic, test it in isolation" pattern.
 *
 * Design notes:
 * - This controller does NOT own a timer. `components/ui/Toast.tsx` is the
 *   single owner of the 3s countdown (GYM-94's designated toast primitive —
 *   do not fork it); the screen wires Toast's `onTimeout` to `flush()` and
 *   `onUndo` to `undo()`. (RoutineEditorScreen predates Toast.tsx's
 *   promotion into components/ui/ and re-implements its own parallel
 *   setTimeout + inline toast JSX — that duplication is pre-existing and
 *   out of scope here; this controller doesn't repeat it.)
 * - CustomProgramBuilderScreen edits multiple splits at once (unlike
 *   RoutineEditorScreen's single active split), so a pending op carries its
 *   own `splitId` rather than relying on one screen-wide "active split."
 * - Only ONE op is pending at a time — a single toast, matching
 *   RoutineEditorScreen. Starting a new op (whether on the same split or a
 *   different one — a user could plausibly trigger adds on two different
 *   splits inside the same 3s window, since every split's controls are
 *   visible simultaneously in this screen) COMMITS the prior op rather than
 *   dropping it, so an in-flight write is never silently lost.
 * - `discard()` is the one path that neither commits nor undoes: it exists
 *   for the case where the pending op's own split is being deleted out from
 *   under it (see handleRemoveSplit). Flushing would write the exercise
 *   into a split about to be archived/removed; undoing would resurrect
 *   local UI state for a split that's disappearing anyway. Discarding just
 *   drops the pending write and clears the toast.
 */

export interface PendingOp {
  splitId: string
  message: string
  flush: () => Promise<void>
  undo: () => void
}

export interface PendingOpController {
  /** The currently pending op, or null. */
  readonly current: PendingOp | null
  /** Stage a new op. Commits (flushes) any op already in flight first. */
  start: (op: PendingOp) => void
  /** Commit the current op immediately. No-op if nothing is pending. Safe to await. */
  flush: () => Promise<void>
  /** Cancel the current op and run its `undo()`. No-op if nothing is pending. */
  undo: () => void
  /**
   * Drop the current op without flushing or undoing it. If `predicate` is
   * given, only discards when it returns true for the current op (used to
   * scope the drop to a specific splitId); omit it to discard unconditionally.
   */
  discard: (predicate?: (op: PendingOp) => boolean) => void
}

export function createPendingOpController(
  onChange: (op: PendingOp | null) => void
): PendingOpController {
  let currentOp: PendingOp | null = null

  async function flushNow(): Promise<void> {
    const op = currentOp
    if (!op) return
    currentOp = null
    onChange(null)
    try {
      await op.flush()
    } catch {
      // op.flush is responsible for its own UI rollback on failure.
    }
  }

  return {
    get current() {
      return currentOp
    },
    start(op) {
      const prev = currentOp
      currentOp = op
      onChange(op)
      if (prev) prev.flush().catch(() => {})
    },
    flush: flushNow,
    undo() {
      const op = currentOp
      if (!op) return
      currentOp = null
      onChange(null)
      op.undo()
    },
    discard(predicate) {
      const op = currentOp
      if (!op) return
      if (predicate && !predicate(op)) return
      currentOp = null
      onChange(null)
    },
  }
}

// --- Pure array-transform helpers shared by the add/remove flush/undo closures ---

/** Re-insert a removed row, keeping the list ordered by sort_order (mirrors RoutineEditorScreen's undo-restore). */
export function restoreExerciseSorted(
  exercises: RoutineExerciseRow[],
  row: RoutineExerciseRow
): RoutineExerciseRow[] {
  return [...exercises, row].sort((a, b) => a.sort_order - b.sort_order)
}

/** Replace an optimistic temp row with the real DB row once the insert succeeds. */
export function replaceExercise(
  exercises: RoutineExerciseRow[],
  tempId: string,
  realRow: RoutineExerciseRow
): RoutineExerciseRow[] {
  return exercises.map(e => (e.id === tempId ? realRow : e))
}

/** Drop an optimistic temp row — used both for undo and for a failed insert. */
export function dropExercise(exercises: RoutineExerciseRow[], tempId: string): RoutineExerciseRow[] {
  return exercises.filter(e => e.id !== tempId)
}
