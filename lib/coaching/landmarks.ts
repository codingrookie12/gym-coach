/**
 * lib/coaching/landmarks.ts
 *
 * In-code mirror of `training_landmarks` / `set_crediting_rules` (see
 * supabase/migrations/20260822010000_phase2_coaching_engine_schema.sql) for
 * two reasons: (1) the dev/test Supabase branch has no DB-connection
 * credential yet, so the engine and its unit-test suite can't query the
 * table live — this default is what unblocks TDD without a live DB; (2) it's
 * the concrete "swappable via config" proof the Phase 2 exit criterion asks
 * for — engine.ts takes `landmarks`/`setCreditingRule` as plain data inputs,
 * never imports this file directly, so a caller (app code once it can query
 * Supabase, or a test) can substitute an alternate preset with zero code
 * changes. See lib/coaching/__tests__/landmarks.test.ts for the swap proof.
 *
 * Keep in sync with the migration's seed INSERTs if either changes — the
 * migration is the source of truth once applied; this is the offline
 * fallback + default consumed by callers that don't override it.
 */

import { ExperienceLevel, SetCreditingRule, TrainingLandmark } from './types'

export const DEFAULT_SET_CREDITING_RULE: SetCreditingRule = {
  version: 1,
  primaryCredit: 1.0,
  secondaryCredit: 0.5,
  sourceCitation:
    'RP convention: secondary muscle involvement credited at half a primary set, not 1:1 (Israetel et al., Renaissance Periodization hypertrophy guidance).',
}

interface SeedRow {
  muscleGroup: string
  intermediate: [number, number, number] // [mev, mav, mrv]
  citation: string
}

// Base (intermediate) rows — RP-published approximate weekly working-set
// landmarks. Novice (×0.7) / advanced (×1.15) are this app's own documented
// scaling of the principle (lower training age = less recoverable volume;
// higher training age = more volume needed), not independently-cited RP
// numbers per muscle. See the migration file for the full per-row rationale.
const SEED: SeedRow[] = [
  { muscleGroup: 'Chest', intermediate: [8, 16, 22], citation: 'RP published weekly-set landmarks (intermediate), Israetel et al.' },
  { muscleGroup: 'Lats', intermediate: [10, 16, 24], citation: 'RP published weekly-set landmarks (intermediate, back/lats), Israetel et al.' },
  { muscleGroup: 'Middle Back', intermediate: [10, 16, 24], citation: 'RP published weekly-set landmarks (intermediate, back), Israetel et al.' },
  { muscleGroup: 'Lower Back', intermediate: [4, 8, 12], citation: 'RP published weekly-set landmarks (intermediate, lower back — kept conservative), Israetel et al.' },
  { muscleGroup: 'Traps', intermediate: [6, 12, 20], citation: 'RP published weekly-set landmarks (intermediate, traps), Israetel et al.' },
  { muscleGroup: 'Shoulders', intermediate: [8, 16, 24], citation: 'RP published weekly-set landmarks (intermediate, delts combined), Israetel et al.' },
  { muscleGroup: 'Biceps', intermediate: [8, 14, 20], citation: 'RP published weekly-set landmarks (intermediate, biceps), Israetel et al.' },
  { muscleGroup: 'Triceps', intermediate: [6, 12, 18], citation: 'RP published weekly-set landmarks (intermediate, triceps), Israetel et al.' },
  { muscleGroup: 'Forearms', intermediate: [6, 12, 20], citation: 'RP published weekly-set landmarks (intermediate, forearms), Israetel et al.' },
  { muscleGroup: 'Quadriceps', intermediate: [8, 14, 20], citation: 'RP published weekly-set landmarks (intermediate, quads), Israetel et al.' },
  { muscleGroup: 'Hamstrings', intermediate: [6, 12, 20], citation: 'RP published weekly-set landmarks (intermediate, hamstrings), Israetel et al.' },
  { muscleGroup: 'Glutes', intermediate: [4, 10, 16], citation: 'RP published weekly-set landmarks (intermediate, glutes — high compound overlap), Israetel et al.' },
  { muscleGroup: 'Calves', intermediate: [8, 12, 18], citation: 'RP published weekly-set landmarks (intermediate, calves), Israetel et al.' },
  { muscleGroup: 'Adductors', intermediate: [4, 8, 14], citation: 'RP-adjacent estimate (rarely a standalone landmark row) — flagged for checker review.' },
  { muscleGroup: 'Abductors', intermediate: [4, 8, 14], citation: 'RP-adjacent estimate (rarely a standalone landmark row) — flagged for checker review.' },
  { muscleGroup: 'Abdominals', intermediate: [0, 16, 25], citation: 'RP published weekly-set landmarks (intermediate, abs — MEV 0 is RP’s own stated value), Israetel et al.' },
  { muscleGroup: 'Neck', intermediate: [0, 6, 12], citation: 'Conservative estimate — rarely a standalone RP landmark row, low catalog coverage — flagged for checker review.' },
]

const NOVICE_SCALE = 0.7
const ADVANCED_SCALE = 1.15

function scale(value: number, factor: number): number {
  // MEV floor of 0 (e.g. abs, neck) must stay 0 under any scale, not become
  // negative or drift — Math.round(0 * factor) is already 0, no special case
  // needed, but keep it explicit since a landmark MEV of 0 is a real, published
  // RP value (not a missing-data placeholder) and must survive scaling exactly.
  return Math.round(value * factor)
}

function buildLandmarks(version: number): TrainingLandmark[] {
  const rows: TrainingLandmark[] = []
  for (const seed of SEED) {
    const [mev, mav, mrv] = seed.intermediate
    const tiers: { level: ExperienceLevel; factor: number; scaled: boolean }[] = [
      { level: 'novice', factor: NOVICE_SCALE, scaled: true },
      { level: 'intermediate', factor: 1, scaled: false },
      { level: 'advanced', factor: ADVANCED_SCALE, scaled: true },
    ]
    for (const tier of tiers) {
      rows.push({
        muscleGroup: seed.muscleGroup,
        experienceLevel: tier.level,
        version,
        mev: scale(mev, tier.factor),
        mav: scale(mav, tier.factor),
        mrv: scale(mrv, tier.factor),
        sourceCitation: tier.scaled
          ? `Scaled ×${tier.factor} from intermediate base — this app's documented assumption, not an independently-cited RP number. Base: ${seed.citation}`
          : seed.citation,
      })
    }
  }
  return rows
}

export const DEFAULT_LANDMARKS_VERSION = 1
export const DEFAULT_LANDMARKS: TrainingLandmark[] = buildLandmarks(DEFAULT_LANDMARKS_VERSION)

export function getLandmark(
  landmarks: TrainingLandmark[],
  muscleGroup: string,
  experienceLevel: ExperienceLevel
): TrainingLandmark | null {
  return (
    landmarks.find(l => l.muscleGroup === muscleGroup && l.experienceLevel === experienceLevel) ??
    null
  )
}
