/**
 * lib/coaching/ — shared types
 *
 * Phase 2 (Coaching Engine Redesign) — see
 * /Users/johnny/.claude/plans/goal-update-and-fully-memoized-valley.md
 *
 * The single non-negotiable rule for this whole module: no pre-formatted
 * English string, anywhere. Every flag/annotation is `{ kind, params }` —
 * locale-agnostic structured data. A locale-keyed template dictionary (Phase 1
 * infra, `messages/en.json` / `messages/es.json`) renders these per-locale;
 * that rendering never happens inside `lib/coaching/`.
 */

// ─── Experience level / cold-start ─────────────────────────────────────────

export type ExperienceLevel = 'novice' | 'intermediate' | 'advanced'

/** Cold-start default for any user who hasn't answered the onboarding
 *  experience-level question yet (users.experience_level IS NULL). */
export const DEFAULT_EXPERIENCE_LEVEL: ExperienceLevel = 'novice'

// ─── RIR (Reps in Reserve) ──────────────────────────────────────────────────

/** Joint contract with Phase 1's schema prep (sets.rir) and Phase 3's UI —
 *  settled once there, consumed here, never re-decided: integer 0-5+, NULL =
 *  not logged. This module never redefines that domain, only consumes it. */
export type RirValue = number

/** Where a RIR reading used by a recommendation actually came from.
 *  `logged-rir` = the lifter tapped a real RIR value on that set.
 *  `inferred-rep-range` = no RIR was logged; the engine inferred an
 *  approximate effort level from where the rep count landed inside the
 *  exercise's prescribed rep range. This is a weak, near-binary signal —
 *  every recommendation that used it is tagged, never silently blended into
 *  logged-RIR confidence (Phase 2 doer scope item 5). */
export type RirProvenance = 'logged-rir' | 'inferred-rep-range'

export interface RirReading {
  /** 0-5+ integer scale, RP convention: 0 = no reps left, 5+ = very easy. */
  value: RirValue
  origin: RirProvenance
}

// ─── Data maturity ──────────────────────────────────────────────────────────

/** Distinct from RIR-provenance — this is about how much logged history this
 *  user/exercise has at all, not about whether any one set's effort reading
 *  is real. Consumed by later phases for empty-state handling. */
export type DataMaturity = 'limited-history' | 'developing' | 'established'

// ─── Volume landmarks ────────────────────────────────────────────────────────

/** Matches lib/exerciseLibrary.ts's `Muscle` union — the 17-value granularity
 *  exercises.json already tags primary/secondary muscles with, and the same
 *  granularity RP's own published landmark tables use. Kept as `string` here
 *  (not importing `Muscle` directly) so this module has no compile-time
 *  dependency on exerciseLibrary's type — muscleTagging.ts is the one place
 *  that bridges the two. */
export type MuscleGroupKey = string

export interface TrainingLandmark {
  muscleGroup: MuscleGroupKey
  experienceLevel: ExperienceLevel
  version: number
  mev: number
  mav: number
  mrv: number
  sourceCitation: string
}

export interface SetCreditingRule {
  version: number
  primaryCredit: number
  secondaryCredit: number
  sourceCitation: string
}

export type VolumeZone = 'under-mev' | 'mev-mav' | 'mav-mrv' | 'over-mrv'

export interface MuscleVolumeStatus {
  muscleGroup: MuscleGroupKey
  experienceLevel: ExperienceLevel
  weeklyCreditedSets: number
  mev: number
  mav: number
  mrv: number
  zone: VolumeZone
  landmarksVersion: number
  setCreditingVersion: number
}

// ─── Flags / annotations — the locale-agnostic output contract ─────────────

export type CoachingFlagKind =
  | 'no-history'
  | 'progress-ready'
  | 'recovery-hold'
  | 'weight-too-heavy'
  | 'fatigue'
  | 'stall'
  | 'deload-recommended'
  | 'volume-under-mev'
  | 'volume-over-mrv'

/** Only `stall` flags carry a strategyKind (replaces the old hardcoded
 *  `strategies` array at lib/coaching.ts:139). */
export type StallStrategyKind = 'drop-set' | 'pause-reps' | 'grip-angle' | 'deload'

export type CoachingFlagScope = 'exercise' | 'muscle-group' | 'session'

/** Params are always primitive values (string/number/boolean/null) — never a
 *  pre-formatted fragment. Every numeric param a message template needs
 *  (weights, day counts, rep counts, set counts) lives here; the template
 *  dictionary does all interpolation and pluralization per-locale. */
export type CoachingFlagParams = Record<string, string | number | boolean | null>

export interface CoachingFlag {
  /** Stable within one engine run — (scope, exerciseId|muscleGroup, kind,
   *  date) — usable as a dedup/React key and, once Phase 4 persists
   *  annotations, as an idempotency key for upserts. */
  id: string
  kind: CoachingFlagKind
  scope: CoachingFlagScope
  exerciseId: string | null
  muscleGroup: MuscleGroupKey | null
  /** ISO date the flag pertains to (the session date it was raised for), or
   *  null for a flag that isn't tied to one specific date. */
  date: string | null
  params: CoachingFlagParams
  /** 'structural' = not derived from any RIR reading (e.g. a pure rep-range
   *  progression rule, or a volume-landmark comparison). Otherwise the
   *  weakest RIR provenance among the readings the flag used — see
   *  lib/coaching/rir.ts's `combineProvenance`. */
  origin: RirProvenance | 'structural'
  /** Landmark-config + set-crediting version snapshot — Phase 2 doer scope
   *  item 8. Every flag stores the versions that produced it so a later
   *  landmark-default update never silently reinterprets a historical
   *  annotation under new values. Flags that never touch volume landmarks
   *  (e.g. weight-too-heavy) still snapshot the *current* versions for
   *  consistency/traceability, even though they didn't consume them. */
  landmarksVersion: number
  setCreditingVersion: number
}

/** A CoachingFlag IS the coaching-annotation data contract Phase 4's
 *  ProgressHistoryScreen rebuild (GYM-48) renders — no separate shape. */
export type CoachingAnnotation = CoachingFlag

// ─── Per-exercise plan ───────────────────────────────────────────────────────

export interface ExercisePlan {
  exerciseId: string
  exerciseName: string
  targetWeight: number | null
  /** Provenance of the RIR signal (if any) that drove this target-weight
   *  decision. Null when the decision was purely rep-range-structural (e.g.
   *  no-history carry-forward) with no RIR input at all. */
  targetWeightOrigin: RirProvenance | 'structural' | null
  flags: CoachingFlag[]
}

// ─── Top-level coaching context ─────────────────────────────────────────────

export interface CoachingContext {
  lastSessionDate: string | null
  /** GYM-97 fix #10: exercise count for the last session on this split —
   *  restores a brief "LAST SESSION" recap after Phase 3's rebuild dropped
   *  the old engine's `lastSessionSummary` string with no replacement.
   *  Deliberately a plain number, not a pre-formatted string (this module's
   *  no-string-concatenation contract) — the UI layer (CoachingContextScreen)
   *  renders the locale-specific sentence via next-intl's ICU plural syntax.
   *  Null when there's no last session. */
  lastSessionExerciseCount: number | null
  recoveryGapDays: number | null
  dataMaturity: DataMaturity
  deloadRecommended: boolean
  muscleVolume: MuscleVolumeStatus[]
  /** Session-level + muscle-group-level flags (per-exercise flags live on
   *  each ExercisePlan entry, not duplicated here). */
  flags: CoachingFlag[]
  configVersions: { landmarksVersion: number; setCreditingVersion: number }
}

export interface CoachingResult {
  context: CoachingContext
  plan: ExercisePlan[]
}

// ─── Engine inputs ────────────────────────────────────────────────────────────

/** A single logged set, exercise_id-based (not name-based) — the systemic
 *  fix for GYM-92. `rir` is Phase 1's nullable sets.rir column, consumed
 *  verbatim (0-5+ integer, NULL = not logged = infer from rep-range). */
export interface SetLog {
  setNumber: number
  weight: number
  reps: number
  rir: RirValue | null
}

/** One historical session's sets, keyed by exercise_id — replaces
 *  lib/coaching.ts's SessionRecord (which keys by exercise *name*, the exact
 *  root cause of GYM-92: a custom exercise's routine-side name and its
 *  catalog-side canonical name can drift, silently dropping it from every
 *  aggregation). `sessionRpe` is Phase 1's nullable workouts.session_rpe. */
export interface CoachingSession {
  workoutId: string
  date: string
  sessionRpe: number | null
  exercises: Record<string, { sets: SetLog[] }>
}

/** A routine-programmed exercise, wired to the catalog's muscle-group data
 *  via exercise_id (Phase 2 doer scope item 6 — lib/routines.ts carries none
 *  of this today). */
export interface RoutineExerciseWithMuscles {
  exerciseId: string
  exerciseName: string
  repRange: [number, number]
  weightUnit?: 'lbs' | 'pins'
  availableWeights?: number[]
  programNote?: string
  primaryMuscles: MuscleGroupKey[]
  secondaryMuscles: MuscleGroupKey[]
}

export interface AnalyzeCoachingInput {
  today: string
  /** NULL when the user hasn't answered the onboarding question yet — engine
   *  applies DEFAULT_EXPERIENCE_LEVEL (novice), never guesses upward. */
  experienceLevel: ExperienceLevel | null
  /** Exercises programmed for the specific split being planned right now —
   *  drives `plan` (today's target weights/flags). Same single-split scope
   *  the old engine's `routine` parameter had. */
  routine: RoutineExerciseWithMuscles[]
  /** This split's own session history — drives per-exercise
   *  progression/stall/weight-too-heavy/fatigue, same single-split scope the
   *  old engine had. */
  sessions: CoachingSession[]
  /** All of the user's recent sessions across the WHOLE program (every
   *  split, not just this one) — drives weekly muscle-volume tallying, which
   *  is inherently cross-split (a muscle trained Monday's Push and
   *  Thursday's Pull both count toward one weekly total). Superset of
   *  `sessions` when the split being planned is itself recent; callers may
   *  pass the same array for both if the whole program is a single split. */
  programSessions: CoachingSession[]
  /** Muscle-group tags for every exercise that might appear in
   *  `programSessions` (not just `routine`) — otherwise volume tallying
   *  would silently miss any exercise trained outside today's split. Keyed
   *  by exerciseId, same identifier space as `routine`/`sessions`. */
  exerciseMuscles: Record<string, { primaryMuscles: MuscleGroupKey[]; secondaryMuscles: MuscleGroupKey[] }>
  weightOverrides: Record<string, number>
  landmarks: TrainingLandmark[]
  setCreditingRule: SetCreditingRule
}
