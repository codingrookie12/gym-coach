/**
 * lib/coaching/engine.ts
 *
 * Phase 2 — Coaching Engine Redesign. Volume-landmark (MEV/MAV/MRV, keyed by
 * muscle group + experience level) + RIR/RPE autoregulation + fatigue-
 * triggered deload, emitting the fully locale-agnostic `{kind, params}`
 * output contract (see lib/coaching/types.ts). Exercise matching is
 * exercise_id-based end to end (lib/coaching/matching.ts) — the systemic fix
 * for GYM-92.
 *
 * Deliberately lives beside, not instead of, the old lib/coaching.ts —
 * see that file's own docstring-equivalent context in the plan: the old
 * engine stays diffable for backtesting (checker scope), this module is a
 * clean-room reimplementation, not a refactor of it.
 */

import {
  AnalyzeCoachingInput,
  CoachingContext,
  CoachingFlag,
  CoachingResult,
  DEFAULT_EXPERIENCE_LEVEL,
  ExercisePlan,
  RirReading,
} from './types'
import { buildFlag, pickStallStrategy } from './flags'
import { resolveRir, combineProvenance } from './rir'
import { computeDataMaturity } from './dataMaturity'
import {
  computeDeloadRecommendation,
  computeExerciseFatigueSignal,
  computeSessionRpeFatigueSignal,
} from './fatigue'
import { buildMuscleVolumeStatus } from './volume'

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime()
  const b = new Date(dateB).getTime()
  return Math.abs(Math.round((a - b) / (1000 * 60 * 60 * 24)))
}

/** Defensive: callers should already pass sessions sorted most-recent-first
 *  (matching the old engine's documented SessionRecord contract), but the
 *  engine doesn't trust that silently — an out-of-order `sessions` array
 *  would otherwise corrupt every "latest session" / "consecutive sessions"
 *  computation below with no visible symptom. */
function sortSessionsDesc<T extends { date: string }>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

function snapWeightUp(latestMaxWeight: number, availableWeights: number[] | undefined, fallbackIncrement: number): number {
  if (availableWeights && availableWeights.length > 0) {
    const next = availableWeights.find(w => w > latestMaxWeight)
    return next ?? latestMaxWeight
  }
  return latestMaxWeight + fallbackIncrement
}

function snapWeightDown(latestMaxWeight: number, availableWeights: number[] | undefined, fallbackIncrement: number): number {
  if (availableWeights && availableWeights.length > 0) {
    const prev = [...availableWeights].reverse().find(w => w < latestMaxWeight)
    return prev ?? latestMaxWeight
  }
  return Math.max(latestMaxWeight - fallbackIncrement, 0)
}

function defaultIncrement(exerciseName: string, weightUnit: 'lbs' | 'pins' | undefined): number {
  if (weightUnit === 'pins') return 1
  const lower = exerciseName.toLowerCase()
  return lower.includes('dumbbell') || lower.includes('cable') ? 2.5 : 5
}

export function analyzeCoaching(input: AnalyzeCoachingInput): CoachingResult {
  const {
    today,
    routine,
    weightOverrides,
    landmarks,
    setCreditingRule,
    exerciseMuscles,
    programSessions,
  } = input

  const experienceLevel = input.experienceLevel ?? DEFAULT_EXPERIENCE_LEVEL
  const sessions = sortSessionsDesc(input.sessions)
  const lastSession = sessions[0] ?? null
  const recoveryGapDays = lastSession ? daysBetween(today, lastSession.date) : null

  const landmarksVersion = landmarks[0]?.version ?? 0
  const versions = { landmarksVersion, setCreditingVersion: setCreditingRule.version }

  const sessionFlags: CoachingFlag[] = []
  const perExerciseFatigueSignals: ReturnType<typeof computeExerciseFatigueSignal>[] = []

  const plan: ExercisePlan[] = routine.map((exercise): ExercisePlan => {
    const flags: CoachingFlag[] = []
    const exerciseId = exercise.exerciseId

    const exerciseSessions = sessions
      .map(s => ({ date: s.date, sets: s.exercises[exerciseId]?.sets }))
      .filter((s): s is { date: string; sets: NonNullable<typeof s.sets> } => !!s.sets && s.sets.length > 0)

    // ─── No history for this exercise in this split ──────────────────────
    if (exerciseSessions.length === 0) {
      const overrideWeight = weightOverrides[exerciseId] ?? null
      if (overrideWeight === null) {
        flags.push(
          buildFlag({
            kind: 'no-history',
            scope: 'exercise',
            exerciseId,
            date: today,
            params: {},
            origin: 'structural',
            ...versions,
          })
        )
      }
      return {
        exerciseId,
        exerciseName: exercise.exerciseName,
        targetWeight: overrideWeight,
        targetWeightOrigin: overrideWeight !== null ? 'structural' : null,
        flags,
      }
    }

    const latest = exerciseSessions[0]
    const latestMaxWeight = Math.max(...latest.sets.map(s => s.weight))

    // RIR readings for the latest session's sets — real or inferred, tagged.
    const latestReadings: RirReading[] = latest.sets.map(s => resolveRir(s.rir, s.reps, exercise.repRange))

    // Fatigue signal #1 (kept from the old engine, re-tagged structural):
    // reps drop significantly within one session.
    if (latest.sets.length >= 3) {
      const reps = latest.sets.map(s => s.reps).filter(r => r > 0)
      if (reps.length >= 3 && reps[0] > 0) {
        const dropRatio = reps[reps.length - 1] / reps[0]
        if (dropRatio < 0.75) {
          flags.push(
            buildFlag({
              kind: 'fatigue',
              scope: 'exercise',
              exerciseId,
              date: latest.date,
              params: { firstSetReps: reps[0], lastSetReps: reps[reps.length - 1] },
              origin: 'structural',
              ...versions,
            })
          )
        }
      }
    }

    // Fatigue signal #2 (new — RIR trend across recent sessions).
    const readingsBySessionDesc: RirReading[][] = exerciseSessions
      .slice(0, 3)
      .map(es => es.sets.map(s => resolveRir(s.rir, s.reps, exercise.repRange)))
    const exerciseFatigueSignal = computeExerciseFatigueSignal(exerciseId, readingsBySessionDesc)
    perExerciseFatigueSignals.push(exerciseFatigueSignal)
    const hasFatigue = flags.some(f => f.kind === 'fatigue') || exerciseFatigueSignal.fatigued
    if (exerciseFatigueSignal.fatigued && !flags.some(f => f.kind === 'fatigue')) {
      flags.push(
        buildFlag({
          kind: 'fatigue',
          scope: 'exercise',
          exerciseId,
          date: latest.date,
          params: { recentAvgRir: exerciseFatigueSignal.recentAvgRir },
          origin: combineProvenance(readingsBySessionDesc.flat()),
          ...versions,
        })
      )
    }

    // Progression eligibility — structural trigger (rep-range position),
    // same shape as the old engine's rule, RIR-tagged for traceability.
    const topOfRange = exercise.repRange[1]
    let consecutiveFullSessions = 0
    const qualifyingReadings: RirReading[] = []
    for (const es of exerciseSessions) {
      const allHitTop = es.sets.every(s => s.reps >= topOfRange)
      if (allHitTop) {
        consecutiveFullSessions++
        qualifyingReadings.push(...es.sets.map(s => resolveRir(s.rir, s.reps, exercise.repRange)))
      } else break
    }
    const shouldProgress = consecutiveFullSessions >= 2
    const recoveryHold = recoveryGapDays !== null && recoveryGapDays < 3

    // Reverse rule: 2 consecutive sessions with any set below bottom of range.
    const bottomOfRange = exercise.repRange[0]
    let hasWeightTooHeavy = false
    if (exerciseSessions.length >= 2) {
      const belowBottom = exerciseSessions
        .slice(0, 2)
        .every(es => es.sets.some(s => s.reps < bottomOfRange))
      if (belowBottom) {
        hasWeightTooHeavy = true
        flags.push(
          buildFlag({
            kind: 'weight-too-heavy',
            scope: 'exercise',
            exerciseId,
            date: latest.date,
            params: { bottomOfRange, weight: latestMaxWeight },
            origin: 'structural',
            ...versions,
          })
        )
      }
    }

    // Stall: no progression in 3+ sessions (kept — distinct from the deload
    // trigger below, which is now fatigue-signal-driven per Phase 2 item 9).
    const latestWeight = latest.sets[0]?.weight ?? 0
    const noProgressCount = exerciseSessions.filter(es => es.sets[0]?.weight === latestWeight).length
    if (noProgressCount >= 3 && !shouldProgress) {
      flags.push(
        buildFlag({
          kind: 'stall',
          scope: 'exercise',
          exerciseId,
          date: latest.date,
          params: { sessionCount: noProgressCount, strategyKind: pickStallStrategy(noProgressCount) },
          origin: 'structural',
          ...versions,
        })
      )
    }

    const increment = defaultIncrement(exercise.exerciseName, exercise.weightUnit)

    let targetWeight = latestMaxWeight
    let targetWeightOrigin: CoachingFlag['origin'] | null = 'structural'

    if (hasFatigue) {
      targetWeight = snapWeightDown(latestMaxWeight, exercise.availableWeights, increment)
      targetWeightOrigin = combineProvenance(latestReadings)
    } else if (hasWeightTooHeavy) {
      targetWeight = snapWeightDown(latestMaxWeight, exercise.availableWeights, increment)
      targetWeightOrigin = 'structural'
    } else if (shouldProgress && !recoveryHold) {
      targetWeight = snapWeightUp(latestMaxWeight, exercise.availableWeights, increment)
      flags.push(
        buildFlag({
          kind: 'progress-ready',
          scope: 'exercise',
          exerciseId,
          date: latest.date,
          params: { fromWeight: latestMaxWeight, toWeight: targetWeight, topOfRange },
          origin: combineProvenance(qualifyingReadings.length ? qualifyingReadings : latestReadings),
          ...versions,
        })
      )
      targetWeightOrigin = combineProvenance(qualifyingReadings.length ? qualifyingReadings : latestReadings)
    } else if (shouldProgress && recoveryHold) {
      flags.push(
        buildFlag({
          kind: 'recovery-hold',
          scope: 'exercise',
          exerciseId,
          date: latest.date,
          params: { recoveryGapDays },
          origin: 'structural',
          ...versions,
        })
      )
    }

    return {
      exerciseId,
      exerciseName: exercise.exerciseName,
      targetWeight,
      targetWeightOrigin,
      flags,
    }
  })

  // ─── Session-level deload recommendation (fatigue-signal-driven) ───────
  const sessionRpeSignal = computeSessionRpeFatigueSignal(sessions)
  const deloadRecommended = computeDeloadRecommendation(perExerciseFatigueSignals, sessionRpeSignal)
  if (deloadRecommended) {
    const fatiguedRirReadings = plan
      .flatMap(p => p.flags)
      .filter(f => f.kind === 'fatigue')
      .map(f => f.origin)
    sessionFlags.push(
      buildFlag({
        kind: 'deload-recommended',
        scope: 'session',
        date: today,
        params: {
          fatiguedExerciseCount: perExerciseFatigueSignals.filter(s => s.fatigued).length,
          recentAvgSessionRpe: sessionRpeSignal.recentAvgSessionRpe,
        },
        origin: fatiguedRirReadings.includes('inferred-rep-range') ? 'inferred-rep-range' : sessionRpeSignal.fatigued ? 'structural' : 'logged-rir',
        ...versions,
      })
    )
  }

  // ─── Muscle-group volume landmarks ──────────────────────────────────────
  // `muscleVolume` itself stays the full, ungated table (every muscle group
  // with a landmark for this experience level) — it's the raw data other
  // consumers (a future full-program stats view) may want untouched. What we
  // curate into `sessionFlags` (the actionable call-outs THIS session's
  // screen surfaces) is deliberately narrower, for two reasons found live in
  // the app (a brand-new user's pre-session screen dumping an under-MEV flag
  // for all ~17 muscle groups at once):
  //
  // 1. A weekly-volume comparison is close to meaningless before the user
  //    has something like a full month of real logging — `established` is
  //    the dataMaturity tier that already gates this screen's "still
  //    learning your baseline" notice (see CoachingContextScreen.tsx), so
  //    gating volume flags the same way keeps the screen from asserting
  //    confident volume-deficit claims in the same breath it's telling the
  //    user their baseline isn't known yet.
  // 2. Even once established, a muscle group with zero relevance to what's
  //    actually programmed today (e.g. flagging Glutes/Hamstrings/Calves on
  //    an upper-body day) is noise on a *pre-session* screen — scope to
  //    muscles this specific session's routine actually trains.
  const dataMaturity = computeDataMaturity(programSessions.length)
  const todaysMuscleGroups = new Set(routine.flatMap(r => [...r.primaryMuscles, ...r.secondaryMuscles]))
  const muscleVolume = buildMuscleVolumeStatus(
    programSessions,
    exerciseMuscles,
    today,
    experienceLevel,
    landmarks,
    setCreditingRule
  )
  if (dataMaturity === 'established') {
    for (const status of muscleVolume) {
      if (!todaysMuscleGroups.has(status.muscleGroup)) continue
      if (status.zone === 'under-mev') {
        sessionFlags.push(
          buildFlag({
            kind: 'volume-under-mev',
            scope: 'muscle-group',
            muscleGroup: status.muscleGroup,
            date: today,
            params: { weeklyCreditedSets: status.weeklyCreditedSets, mev: status.mev },
            origin: 'structural',
            landmarksVersion: status.landmarksVersion,
            setCreditingVersion: status.setCreditingVersion,
          })
        )
      } else if (status.zone === 'over-mrv') {
        sessionFlags.push(
          buildFlag({
            kind: 'volume-over-mrv',
            scope: 'muscle-group',
            muscleGroup: status.muscleGroup,
            date: today,
            params: { weeklyCreditedSets: status.weeklyCreditedSets, mrv: status.mrv },
            origin: 'structural',
            landmarksVersion: status.landmarksVersion,
            setCreditingVersion: status.setCreditingVersion,
          })
        )
      }
    }
  }

  const context: CoachingContext = {
    lastSessionDate: lastSession?.date ?? null,
    recoveryGapDays,
    dataMaturity,
    deloadRecommended,
    muscleVolume,
    flags: sessionFlags,
    configVersions: versions,
  }

  return { context, plan }
}
