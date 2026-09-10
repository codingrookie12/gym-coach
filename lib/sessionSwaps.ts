// Session-swap-chain collapsing — extracted out of app/page.tsx's
// handleSessionSwap (an inline closure inside a large stateful client
// component, not directly testable — same reasoning as lib/finishSaveDiff.ts)
// so this has direct test coverage.
//
// Bug this closes (found during the session-lifecycle write-path audit,
// Area 2 — "make default" permanent exercise swap): ActiveSessionScreen's
// "browse all" mid-session swap feature reports each swap as
// `(currentEx.exerciseName, newName)` at the moment it happens — so
// swapping the same plan slot twice in one session (A→B, then, from that
// same slot now showing B, B→C) fires onSessionSwap('A','B') and then
// onSessionSwap('B','C') as two independent calls. Naively appending both
// to `sessionSwaps` produced two "make default?" rows in
// PreSaveSummaryScreen — a stale "A → B" alongside the real "B → C" — even
// though the exercise actually logged and saved for that slot is C, not B.
// Confirming the stale row would call permanentlySwapExercise('A', 'B'),
// permanently setting the user's routine to an exercise with zero of the
// session's logged data behind it, while the real result (C) might never
// get offered at all.
//
// The fix: collapse a chain into a single entry against the ORIGINAL
// routine exercise once it's known to chain (previous entry's `newName`
// equals this swap's `oldName`) — so `sessionSwaps` always reflects
// "this original routine exercise ended the session as this one", not the
// raw sequence of intermediate hops. A round-trip swap (A→B→A) collapses to
// nothing — no "make default?" needed when a slot's net effect is no swap.

export interface SessionSwap {
  oldName: string
  newName: string
}

/**
 * Fold one new (oldName, newName) swap event into the existing list,
 * collapsing a chain onto its original routine exercise. Returns a new
 * array (never mutates `swaps`).
 */
export function mergeSessionSwap(
  swaps: SessionSwap[],
  oldName: string,
  newName: string
): SessionSwap[] {
  const chainedIdx = swaps.findIndex(s => s.newName === oldName)

  if (chainedIdx === -1) {
    return [...swaps, { oldName, newName }]
  }

  const original = swaps[chainedIdx].oldName
  const next = [...swaps]
  if (newName === original) {
    // Swapped back to the exercise the slot started the session with — net
    // no-op, nothing to offer "make default?" for.
    next.splice(chainedIdx, 1)
  } else {
    next[chainedIdx] = { oldName: original, newName }
  }
  return next
}
