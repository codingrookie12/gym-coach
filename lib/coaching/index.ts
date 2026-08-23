/**
 * lib/coaching/ — public API.
 *
 * The old lib/coaching.ts (analyzeCoaching, CoachingFlag, CoachingContext,
 * ExercisePlan) is untouched and stays importable at its old path — this
 * module is a parallel, clean-room engine, not a replacement import. Callers
 * migrate deliberately (Phase 3), not via a silent re-export swap.
 */

export * from './types'
export { analyzeCoaching } from './engine'
export { DEFAULT_LANDMARKS, DEFAULT_LANDMARKS_VERSION, DEFAULT_SET_CREDITING_RULE, getLandmark } from './landmarks'
export { resolveRir, inferRirFromRepRange, combineProvenance, averageRir } from './rir'
export { computeDataMaturity } from './dataMaturity'
export {
  computeDeloadRecommendation,
  computeExerciseFatigueSignal,
  computeSessionRpeFatigueSignal,
} from './fatigue'
export { tallyWeeklyVolume, buildMuscleVolumeStatus, classifyZone } from './volume'
export type { ExerciseMuscleMap } from './volume'
export { buildFlag, pickStallStrategy } from './flags'
export { resolveExerciseId, unresolvedExerciseId, isUnresolvedExerciseId } from './matching'
export type { MatchableCatalogEntry } from './matching'
export { wireRoutineToMuscles, buildExerciseMuscleMap } from './muscleTagging'
export type { RoutineExerciseInput, CatalogMuscleEntry, WireResult } from './muscleTagging'
