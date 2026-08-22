/**
 * lib/coaching/fatigue.ts
 *
 * Fatigue-triggered deload — Phase 2 doer scope item 9, replacing the old
 * engine's `noProgressCount >= 4` calendar/count trigger (lib/coaching.ts:149)
 * with a genuinely fatigue-signal-driven one: RIR trend per exercise +
 * session RPE, not a stall counter.
 *
 * Session-RPE convention (Tier 2 — Phase 1's schema prep left the polarity/
 * scale unspecified, this is this engine's documented choice, and the joint
 * contract Phase 3's UI must follow when it builds the actual input control):
 * `workouts.session_rpe` is an integer 1-10, Foster's session-RPE convention
 * — HIGHER = harder/more fatiguing session, not a "readiness" scale where
 * higher is better. A 9-10 session RPE is a hard, fatiguing session.
 */

import { CoachingSession, RirReading } from './types'
import { averageRir } from './rir'

const RECENT_SESSIONS_WINDOW = 3
const LOW_RIR_FATIGUE_THRESHOLD = 1 // avg RIR at/below this = grinding near failure repeatedly
const HIGH_SESSION_RPE_THRESHOLD = 8 // Foster's 1-10 scale, higher = harder
const MIN_EXERCISES_WITH_RIR_FATIGUE = 2 // require corroboration across >1 exercise, not a single lift's bad day

export interface PerExerciseFatigueSignal {
  exerciseId: string
  recentAvgRir: number | null
  fatigued: boolean
}

/**
 * Per exercise: average RIR (real or inferred, whichever `resolveRir` already
 * produced upstream) over the most recent sessions. A low, consistent
 * average — not one bad set — is the fatigue signal.
 */
export function computeExerciseFatigueSignal(
  exerciseId: string,
  readingsBySessionDesc: RirReading[][] // most-recent session first, each entry = that session's readings for this exercise
): PerExerciseFatigueSignal {
  const recent = readingsBySessionDesc.slice(0, RECENT_SESSIONS_WINDOW).flat()
  const avg = averageRir(recent)
  return {
    exerciseId,
    recentAvgRir: avg,
    fatigued: avg !== null && avg <= LOW_RIR_FATIGUE_THRESHOLD,
  }
}

export function computeSessionRpeFatigueSignal(sessionsDesc: CoachingSession[]): {
  recentAvgSessionRpe: number | null
  fatigued: boolean
} {
  const recent = sessionsDesc
    .slice(0, RECENT_SESSIONS_WINDOW)
    .map(s => s.sessionRpe)
    .filter((v): v is number => v !== null && v !== undefined)

  if (recent.length === 0) return { recentAvgSessionRpe: null, fatigued: false }
  const avg = recent.reduce((sum, v) => sum + v, 0) / recent.length
  return { recentAvgSessionRpe: avg, fatigued: avg >= HIGH_SESSION_RPE_THRESHOLD }
}

/**
 * Whole-split deload recommendation: true when either (a) at least
 * `MIN_EXERCISES_WITH_RIR_FATIGUE` exercises show a sustained low-RIR
 * fatigue signal, or (b) recent session RPE is consistently high. Either
 * signal alone is enough to trigger — they're independent fatigue channels,
 * not required to co-occur.
 */
export function computeDeloadRecommendation(
  perExerciseSignals: PerExerciseFatigueSignal[],
  sessionRpeSignal: { fatigued: boolean }
): boolean {
  const fatiguedExerciseCount = perExerciseSignals.filter(s => s.fatigued).length
  return fatiguedExerciseCount >= MIN_EXERCISES_WITH_RIR_FATIGUE || sessionRpeSignal.fatigued
}
