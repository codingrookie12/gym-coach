// GYM-79: Program templates — code-level seed data for curated programs.
//
// In the delete-first architecture, every program in the running app is a
// `user_programs` row. Curated programs (PPL, 5/3/1, etc.) are not runtime
// objects — they are TEMPLATES used at clone time only.
//
// This file imports the existing exercise data from `lib/routines.ts` and the
// presentation metadata from `lib/programs.ts`, and assembles them into the
// canonical `ProgramTemplate` shape that `lib/userProgram.ts::cloneTemplate`
// will consume.
//
// Once the migration is complete and nothing else imports the legacy registries
// in `lib/routines.ts`, those exports can be deleted.
//
// NOTE: This file does NOT add new data — it re-shapes existing curated data.

import type { Exercise } from './routines'
import {
  PUSH_ROUTINE,
  PULL_ROUTINE,
  LEGS_ROUTINE,
  getRoutineForProgram,
} from './routines'
import {
  PPL_PROGRAM,
  WENDLER_531_PROGRAM,
  UPPER_LOWER_PROGRAM,
  FULL_BODY_3X_PROGRAM,
  STRONGLIFTS_5X5_PROGRAM,
  type Program,
  type ProgramPresentation,
  type ProgramStyle,
  type ProgramTier,
} from './programs'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single exercise inside a template split. Mirrors the runtime `Exercise`
 * shape but only carries the fields needed at clone time.
 */
export interface TemplateExercise {
  name: string                    // UI display name; also used as exercise_name in DB row
  notionName: string              // Canonical library name (lib/exercises.json)
  sets: number
  repRange: [number, number]
  backup: string | null
  weightUnit?: 'lbs' | 'pins'
  weightConvention?: string
  programNote?: string            // e.g. 5/3/1 wave info — preserved into user_routine_exercises.program_note
}

export interface TemplateSplit {
  name: string                    // Split display name (e.g. "Push", "OHP Day")
  muscles: string[]               // Muscle labels for the carousel
  exercises: TemplateExercise[]
}

/**
 * A curated program template. Used only at clone time to materialize a
 * `user_programs` row + child `user_program_splits` + `user_routine_exercises`.
 */
export interface ProgramTemplate {
  id: string                      // 'ppl-default' / 'wendler-531' / etc.
  name: string                    // Display name when shown as a card
  shortName: string
  splits: TemplateSplit[]         // Ordered (sort_order = array index)
  presentation: ProgramPresentation
  tier: ProgramTier
  style: ProgramStyle
  level: 'beginner' | 'intermediate' | 'advanced'
  daysPerWeek: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps an Exercise from `lib/routines.ts` into a TemplateExercise. */
function toTemplateExercise(ex: Exercise): TemplateExercise {
  return {
    name: ex.name,
    notionName: ex.notionName,
    sets: ex.sets,
    repRange: ex.repRange,
    backup: ex.backup,
    weightUnit: ex.weightUnit,
    weightConvention: ex.weightConvention,
    programNote: ex.programNote,
  }
}

/** Builds the splits array for a curated `Program` from the legacy registries. */
function buildSplitsFromProgram(program: Program, splitRoutines: Record<string, Exercise[]>): TemplateSplit[] {
  return program.splits.map(splitName => ({
    name: splitName,
    muscles: program.splitMuscles[splitName] ?? [],
    exercises: (splitRoutines[splitName] ?? []).map(toTemplateExercise),
  }))
}

/** Builds the splits array for a program by querying `getRoutineForProgram` per split. */
function buildSplitsViaResolver(program: Program): TemplateSplit[] {
  return program.splits.map(splitName => ({
    name: splitName,
    muscles: program.splitMuscles[splitName] ?? [],
    exercises: getRoutineForProgram(program.id, splitName).map(toTemplateExercise),
  }))
}

/** Assembles a `ProgramTemplate` from a `Program` + its splits resolver. */
function fromProgram(program: Program, splits: TemplateSplit[]): ProgramTemplate {
  return {
    id: program.id,
    name: program.name,
    shortName: program.shortName,
    splits,
    presentation: program.presentation,
    tier: program.tier,
    style: program.style,
    level: program.level,
    daysPerWeek: program.daysPerWeek,
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export const PPL_TEMPLATE: ProgramTemplate = fromProgram(
  PPL_PROGRAM,
  buildSplitsFromProgram(PPL_PROGRAM, {
    Push: PUSH_ROUTINE,
    Pull: PULL_ROUTINE,
    Legs: LEGS_ROUTINE,
  }),
)

export const WENDLER_531_TEMPLATE: ProgramTemplate = fromProgram(
  WENDLER_531_PROGRAM,
  buildSplitsViaResolver(WENDLER_531_PROGRAM),
)

export const UPPER_LOWER_TEMPLATE: ProgramTemplate = fromProgram(
  UPPER_LOWER_PROGRAM,
  buildSplitsViaResolver(UPPER_LOWER_PROGRAM),
)

export const FULL_BODY_3X_TEMPLATE: ProgramTemplate = fromProgram(
  FULL_BODY_3X_PROGRAM,
  buildSplitsViaResolver(FULL_BODY_3X_PROGRAM),
)

export const STRONGLIFTS_5X5_TEMPLATE: ProgramTemplate = fromProgram(
  STRONGLIFTS_5X5_PROGRAM,
  buildSplitsViaResolver(STRONGLIFTS_5X5_PROGRAM),
)

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  PPL_TEMPLATE,
  WENDLER_531_TEMPLATE,
  UPPER_LOWER_TEMPLATE,
  FULL_BODY_3X_TEMPLATE,
  STRONGLIFTS_5X5_TEMPLATE,
]

export function getTemplateById(id: string): ProgramTemplate | undefined {
  return PROGRAM_TEMPLATES.find(t => t.id === id)
}
