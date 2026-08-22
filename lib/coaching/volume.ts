/**
 * lib/coaching/volume.ts
 *
 * Weekly muscle-group volume tallying against MEV/MAV/MRV landmarks —
 * Phase 2 doer scope items 4/7. Counts *working sets* (RP convention — not
 * reps, not tonnage), credited per exercise's primary/secondary muscle
 * involvement per the versioned set-crediting rule (item 7), classified
 * against the (muscle_group, experience_level, version)-keyed landmark
 * (item 4).
 */

import {
  CoachingSession,
  ExperienceLevel,
  MuscleGroupKey,
  MuscleVolumeStatus,
  SetCreditingRule,
  TrainingLandmark,
  VolumeZone,
} from './types'
import { getLandmark } from './landmarks'

const WEEKLY_WINDOW_DAYS = 7

function daysBetween(a: string, b: string): number {
  return Math.abs(Math.round((new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24)))
}

export interface ExerciseMuscleMap {
  [exerciseId: string]: { primaryMuscles: MuscleGroupKey[]; secondaryMuscles: MuscleGroupKey[] }
}

/**
 * Tallies credited working sets per muscle group across every session within
 * `WEEKLY_WINDOW_DAYS` of `today` (inclusive). Exercises with no muscle-tag
 * entry in `exerciseMuscles` contribute 0 volume and are silently skipped —
 * a real, documented limitation (an exercise logged that isn't in the
 * muscle-tag map, e.g. a brand-new custom exercise the tagging step hasn't
 * seen yet) rather than a crash; callers should treat a mid-workout untagged
 * custom exercise as a case worth surfacing upstream, not this function's job.
 */
export function tallyWeeklyVolume(
  sessions: CoachingSession[],
  exerciseMuscles: ExerciseMuscleMap,
  today: string,
  setCreditingRule: SetCreditingRule
): Map<MuscleGroupKey, number> {
  const totals = new Map<MuscleGroupKey, number>()

  for (const session of sessions) {
    if (daysBetween(today, session.date) > WEEKLY_WINDOW_DAYS) continue
    for (const [exerciseId, entry] of Object.entries(session.exercises)) {
      const muscles = exerciseMuscles[exerciseId]
      if (!muscles) continue
      const workingSets = entry.sets.length
      if (workingSets === 0) continue

      for (const m of muscles.primaryMuscles) {
        totals.set(m, (totals.get(m) ?? 0) + workingSets * setCreditingRule.primaryCredit)
      }
      for (const m of muscles.secondaryMuscles) {
        totals.set(m, (totals.get(m) ?? 0) + workingSets * setCreditingRule.secondaryCredit)
      }
    }
  }

  return totals
}

export function classifyZone(weeklyCreditedSets: number, landmark: TrainingLandmark): VolumeZone {
  if (weeklyCreditedSets < landmark.mev) return 'under-mev'
  if (weeklyCreditedSets < landmark.mav) return 'mev-mav'
  if (weeklyCreditedSets <= landmark.mrv) return 'mav-mrv'
  return 'over-mrv'
}

/**
 * Builds the full muscle-volume status list — one row per muscle group that
 * either has logged volume this week or has a landmark defined for it, so a
 * muscle at 0 sets/week still shows as `under-mev` rather than being omitted
 * (an omission would look identical to "not part of this app's model," which
 * is a much more confusing empty state than an explicit under-target flag).
 */
export function buildMuscleVolumeStatus(
  sessions: CoachingSession[],
  exerciseMuscles: ExerciseMuscleMap,
  today: string,
  experienceLevel: ExperienceLevel,
  landmarks: TrainingLandmark[],
  setCreditingRule: SetCreditingRule
): MuscleVolumeStatus[] {
  const totals = tallyWeeklyVolume(sessions, exerciseMuscles, today, setCreditingRule)
  const relevantMuscles = new Set<MuscleGroupKey>([
    ...Array.from(totals.keys()),
    ...landmarks.filter(l => l.experienceLevel === experienceLevel).map(l => l.muscleGroup),
  ])

  const result: MuscleVolumeStatus[] = []
  for (const muscleGroup of Array.from(relevantMuscles)) {
    const landmark = getLandmark(landmarks, muscleGroup, experienceLevel)
    if (!landmark) continue // no landmark defined for this muscle group — nothing to compare against
    const weeklyCreditedSets = Math.round((totals.get(muscleGroup) ?? 0) * 100) / 100
    result.push({
      muscleGroup,
      experienceLevel,
      weeklyCreditedSets,
      mev: landmark.mev,
      mav: landmark.mav,
      mrv: landmark.mrv,
      zone: classifyZone(weeklyCreditedSets, landmark),
      landmarksVersion: landmark.version,
      setCreditingVersion: setCreditingRule.version,
    })
  }

  return result.sort((a, b) => a.muscleGroup.localeCompare(b.muscleGroup))
}
