/**
 * lib/sessionPlan.ts — Phase 3.
 *
 * Bridges Phase 2's coaching engine (lib/coaching/, exercise_id-based,
 * `{kind,params}`-only output) to the UI shape the 16 screens actually
 * render. This is the single most important structural change Phase 3
 * makes: every screen switches from `lib/coaching.ts`'s `analyzeCoaching`
 * (name-based matching, pre-formatted English `coachingNote` strings) to
 * this module, which calls the NEW `lib/coaching/` engine and re-attaches
 * the display metadata (sets, repRange, weightUnit, availableWeights,
 * backup, split) the new engine's own `ExercisePlan` type deliberately does
 * NOT carry (lib/coaching/types.ts's `ExercisePlan` is coaching-output-only
 * — ID/targetWeight/flags, no display fields).
 *
 * `SessionExercisePlan` is that merged shape: the old `Exercise` (display)
 * zipped 1:1 (same array order, since lib/coaching/muscleTagging.ts's
 * `wireRoutineToMuscles` and lib/coaching/engine.ts's `analyzeCoaching`
 * both preserve input order via `.map()`) with the new engine's per-exercise
 * targetWeight/targetWeightOrigin/flags.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { Exercise } from '@/lib/routines'
import { getRoutineAsExercises } from '@/lib/userProgram'
import { ALL_EXERCISES } from '@/lib/exerciseLibrary'
// See app/page.tsx's note — the old lib/coaching.ts that used to shadow
// this directory on a bare import was deleted in GYM-97 fix #9.
import {
  analyzeCoaching,
  CoachingContext,
  CoachingFlag,
  DEFAULT_LANDMARKS,
  DEFAULT_SET_CREDITING_RULE,
  RirProvenance,
  wireRoutineToMuscles,
  CatalogMuscleEntry,
  RoutineExerciseInput,
} from '@/lib/coaching/index'
import {
  fetchCoachingSessions,
  fetchProgramSessions,
  fetchExerciseIdsByCanonicalName,
  fetchMuscleTagsByExerciseId,
  fetchExperienceLevel,
  fetchLandmarks,
  fetchSetCreditingRule,
  fetchWeightOverridesByExerciseId,
} from '@/lib/coaching/data'

export interface SessionExercisePlan {
  exercise: Exercise
  exerciseId: string
  targetWeight: number | null
  targetWeightOrigin: RirProvenance | 'structural' | null
  flags: CoachingFlag[]
}

export interface LoadedCoachingPlan {
  context: CoachingContext
  plan: SessionExercisePlan[]
}

// Static catalog view used only to resolve muscle tags for routine wiring —
// {id, name} pairs from the client-bundled exercises.json, NOT the DB's
// exercises.id (see lib/coaching/matching.ts's own docstring on this
// distinction). The real DB exercise_id comes from
// fetchExerciseIdsByCanonicalName below.
const MUSCLE_CATALOG: CatalogMuscleEntry[] = ALL_EXERCISES.map(e => ({
  id: e.id,
  name: e.name,
  primaryMuscles: e.primaryMuscles,
  secondaryMuscles: e.secondaryMuscles,
}))

/**
 * Full data-fetch + wire + analyze pipeline for one split's coaching
 * context screen. Mirrors the old CoachingContextScreen's
 * `analyzeCoaching(programId, split, sessions, today, weightOverrides,
 * routine)` call, but against the new engine's real shape.
 */
export async function loadCoachingPlan(
  supabase: SupabaseClient,
  userId: string,
  userProgramSplitId: string
): Promise<LoadedCoachingPlan> {
  const today = new Date().toISOString().split('T')[0]

  const routineExercises = await getRoutineAsExercises(supabase, userProgramSplitId)

  const [exerciseIdByCanonicalName, sessions, programSessions, experienceLevel, landmarksDb, setCreditingRuleDb, weightOverrides] =
    await Promise.all([
      fetchExerciseIdsByCanonicalName(supabase, routineExercises.map(e => e.canonicalName)),
      fetchCoachingSessions(supabase, userProgramSplitId, 8),
      fetchProgramSessions(supabase, userId, 14),
      fetchExperienceLevel(supabase, userId),
      fetchLandmarks(supabase, 1),
      fetchSetCreditingRule(supabase, 1),
      fetchWeightOverridesByExerciseId(supabase, userId),
    ])

  const routineInputs: RoutineExerciseInput[] = routineExercises.map(e => ({
    name: e.name,
    canonicalName: e.canonicalName,
    repRange: e.repRange,
    weightUnit: e.weightUnit,
    availableWeights: e.availableWeights,
    programNote: e.programNote,
  }))
  const { wired: engineRoutine } = wireRoutineToMuscles(routineInputs, MUSCLE_CATALOG, exerciseIdByCanonicalName)

  // Muscle tags for every exercise appearing anywhere in this pass — the
  // routine being planned AND every exercise across programSessions
  // (cross-split volume tallying needs both; see engine.ts's
  // `exerciseMuscles` param docstring).
  const allExerciseIds = new Set<string>()
  for (const ex of engineRoutine) allExerciseIds.add(ex.exerciseId)
  for (const s of programSessions) for (const exId of Object.keys(s.exercises)) allExerciseIds.add(exId)
  const exerciseMuscles = await fetchMuscleTagsByExerciseId(supabase, Array.from(allExerciseIds))

  const landmarks = landmarksDb.length > 0 ? landmarksDb : DEFAULT_LANDMARKS
  const setCreditingRule = setCreditingRuleDb ?? DEFAULT_SET_CREDITING_RULE

  const { context, plan: enginePlan } = analyzeCoaching({
    today,
    experienceLevel,
    routine: engineRoutine,
    sessions,
    programSessions,
    exerciseMuscles,
    weightOverrides,
    landmarks,
    setCreditingRule,
  })

  // Zip display metadata (routineExercises[i]) with engine output
  // (enginePlan[i]) — both preserve routineExercises' original order.
  const plan: SessionExercisePlan[] = routineExercises.map((exercise, i) => {
    const enginePlanItem = enginePlan[i]
    return {
      exercise,
      exerciseId: enginePlanItem?.exerciseId ?? engineRoutine[i]?.exerciseId ?? '',
      targetWeight: enginePlanItem?.targetWeight ?? null,
      targetWeightOrigin: enginePlanItem?.targetWeightOrigin ?? null,
      flags: enginePlanItem?.flags ?? [],
    }
  })

  return { context, plan }
}
