/**
 * lib/coaching/ — public API.
 *
 * The old lib/coaching.ts (analyzeCoaching, CoachingFlag, CoachingContext,
 * ExercisePlan) was a parallel, clean-room engine's predecessor — every real
 * call site migrated here during Phase 3, and GYM-97 fix #9 deleted the old
 * file once nothing referenced it (it had become an unblocked bare-import
 * footgun: '@/lib/coaching' used to silently resolve to it instead of this
 * directory's index.ts).
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
export { EXERCISE_FLAG_PRIORITY, pickPriorityFlag } from './flagPriority'
