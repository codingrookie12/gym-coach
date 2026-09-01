/**
 * lib/coaching/flagPriority.ts
 *
 * GYM-97 fix #6. The engine deliberately emits an unordered per-exercise
 * `flags[]` array (see lib/coaching/types.ts's CoachingFlag docstring) — it
 * never picks a single "primary" flag itself. Any screen that has room for
 * only one flag per exercise (a compact list row, a next-session summary
 * line) has to pick one, and that pick is a Tier 2 UX choice, not spelled
 * out by the plan.
 *
 * Before this fix, WorkoutOverviewScreen's `ItemFlags` picked by explicit
 * severity (fatigue > stall > weight-too-heavy > recovery-hold >
 * progress-ready) while SessionSummaryScreen picked via a raw `.find()`
 * over a *different*, unordered-by-severity list — so the same exercise
 * state could show a different "the" flag on each screen. This module is
 * the single shared ordering both screens now use.
 */

import { CoachingFlag, CoachingFlagKind } from './types'

export const EXERCISE_FLAG_PRIORITY: CoachingFlagKind[] = [
  'fatigue',
  'stall',
  'weight-too-heavy',
  'recovery-hold',
  'progress-ready',
]

/** Returns the highest-priority flag present in `flags`, or undefined if
 *  none of the prioritized kinds are present. */
export function pickPriorityFlag(flags: CoachingFlag[]): CoachingFlag | undefined {
  for (const kind of EXERCISE_FLAG_PRIORITY) {
    const match = flags.find(f => f.kind === kind)
    if (match) return match
  }
  return undefined
}
