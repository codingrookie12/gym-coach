/**
 * lib/coaching/dataMaturity.ts
 *
 * `dataMaturity` — Phase 2 doer scope item 10. Distinct from RIR-provenance:
 * this is about how much logged history exists at all (session count/depth),
 * not whether any one set's effort reading is real vs. inferred. Later
 * phases (not this one) use it for UI empty-state handling on
 * ProgressHistoryScreen and CoachingContextScreen.
 *
 * Thresholds (Tier 2 — a reasoned default, not spelled out in the plan,
 * flagged for checker/Johnnatan to correct): roughly one month of a 3x/week
 * program is the point recommendations stop being "still learning your
 * baseline" — matches the cold-start framing in Phase 2 item 4 (landmark
 * tier) even though this signal and experience-level are independent.
 */

import { DataMaturity } from './types'

const LIMITED_HISTORY_MAX_SESSIONS = 3
const DEVELOPING_MAX_SESSIONS = 11

export function computeDataMaturity(sessionCount: number): DataMaturity {
  if (sessionCount <= LIMITED_HISTORY_MAX_SESSIONS) return 'limited-history'
  if (sessionCount <= DEVELOPING_MAX_SESSIONS) return 'developing'
  return 'established'
}
