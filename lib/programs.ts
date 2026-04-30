import { Split } from '@/lib/routines'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProgramTier = 1 | 2 | 3

/** Training style — used by AI recommendation engine to match user goals. */
export type ProgramStyle = 'hypertrophy' | 'strength' | 'endurance' | 'powerlifting'

/** Origin of the program — builtin, curated partner, AI-generated, or user-built. */
export type ProgramSource = 'builtin' | 'curated' | 'ai-generated' | 'user-created'

export interface Program {
  id: string
  name: string           // "Push Pull Legs"
  shortName: string      // "PPL"
  description: string
  splits: Split[]
  /** 1 = free tier; 2–3 = paid tiers (gated for free users in Phase 2) */
  tier: ProgramTier
  /** Training style — for AI goal matching and filtering */
  style: ProgramStyle
  /** Experience level targeting */
  level: 'beginner' | 'intermediate' | 'advanced'
  /** Training days per week — for AI scheduling */
  daysPerWeek: number
  /** Where the program comes from — drives discovery UI in Phase 2 */
  source: ProgramSource
}

// ─── Built-in programs ────────────────────────────────────────────────────────

export const PPL_PROGRAM: Program = {
  id: 'ppl-default',
  name: 'Push Pull Legs',
  shortName: 'PPL',
  description: '3-day push/pull/legs split targeting all major muscle groups',
  splits: ['Push', 'Pull', 'Legs'],
  tier: 1,
  style: 'hypertrophy',
  level: 'intermediate',
  daysPerWeek: 3,
  source: 'builtin',
}

// ─── Active program ───────────────────────────────────────────────────────────
// Phase 1: hardcoded PPL.
// Phase 2: load from user profile (localStorage → Supabase user_program table).

export const ACTIVE_PROGRAM: Program = PPL_PROGRAM
