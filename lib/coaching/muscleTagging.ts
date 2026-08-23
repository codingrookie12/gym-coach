/**
 * lib/coaching/muscleTagging.ts
 *
 * Phase 2 doer scope item 6: wire lib/routines.ts's programmed exercises to
 * lib/exercises.json's (via lib/exerciseLibrary.ts) muscle-group metadata.
 * Today only the catalog carries primaryMuscles/secondaryMuscles — routine
 * templates carry none — so the volume-landmark model has nothing to tally
 * against until this wiring exists.
 *
 * Deliberately takes `Exercise[]`/`ExerciseDefinition[]` as plain arguments
 * rather than importing lib/routines.ts / lib/exerciseLibrary.ts directly,
 * so this module (and its tests) has no hard dependency on those files'
 * exact shapes changing underneath it — callers pass what they have.
 */

import { MuscleGroupKey, RoutineExerciseWithMuscles } from './types'
import { MatchableCatalogEntry, resolveExerciseId, unresolvedExerciseId } from './matching'
import { ExerciseMuscleMap } from './volume'

export interface RoutineExerciseInput {
  name: string
  canonicalName: string
  repRange: [number, number]
  weightUnit?: 'lbs' | 'pins'
  availableWeights?: number[]
  programNote?: string
}

export interface CatalogMuscleEntry extends MatchableCatalogEntry {
  primaryMuscles: string[]
  secondaryMuscles: string[]
}

export interface WireResult {
  wired: RoutineExerciseWithMuscles[]
  /** Routine exercises that couldn't be resolved to a real catalog entry —
   *  surfaced so a caller (or the checker) can decide whether that's
   *  expected (e.g. a brand-new custom exercise not yet in the catalog) or a
   *  real data problem, rather than this module silently swallowing it. */
  unresolved: string[]
}

/**
 * `exerciseIdByCanonicalName` — a real DB `exercises.name -> exercises.id`
 * map (a query result, e.g. from lib/coaching/data.ts) when available.
 * Without it (e.g. rendering a curated template preview before any DB round
 * trip), each unresolved exercise gets a synthetic, clearly-marked
 * placeholder id — see matching.ts's `unresolvedExerciseId`.
 */
export function wireRoutineToMuscles(
  routine: RoutineExerciseInput[],
  catalog: CatalogMuscleEntry[],
  exerciseIdByCanonicalName: Record<string, string> = {}
): WireResult {
  const unresolved: string[] = []

  const wired = routine.map((ex): RoutineExerciseWithMuscles => {
    const catalogMatch = resolveExerciseId(catalog, ex.canonicalName)
    const catalogEntry = catalogMatch ? catalog.find(c => c.id === catalogMatch.id) : undefined
    if (!catalogMatch) unresolved.push(ex.canonicalName)

    const exerciseId = exerciseIdByCanonicalName[ex.canonicalName] ?? unresolvedExerciseId(ex.canonicalName)

    return {
      exerciseId,
      exerciseName: ex.name,
      repRange: ex.repRange,
      weightUnit: ex.weightUnit,
      availableWeights: ex.availableWeights,
      programNote: ex.programNote,
      primaryMuscles: (catalogEntry?.primaryMuscles ?? []) as MuscleGroupKey[],
      secondaryMuscles: (catalogEntry?.secondaryMuscles ?? []) as MuscleGroupKey[],
    }
  })

  return { wired, unresolved }
}

export function buildExerciseMuscleMap(wired: RoutineExerciseWithMuscles[]): ExerciseMuscleMap {
  const map: ExerciseMuscleMap = {}
  for (const ex of wired) {
    map[ex.exerciseId] = { primaryMuscles: ex.primaryMuscles, secondaryMuscles: ex.secondaryMuscles }
  }
  return map
}
