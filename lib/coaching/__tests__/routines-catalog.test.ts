import { describe, it, expect } from 'vitest'
import { ALL_EXERCISES } from '@/lib/exerciseLibrary'
import { getAllExercisesForProgram } from '@/lib/routines'

/**
 * Regression test for the live bug found 2026-09: lib/routines.ts's
 * `Exercise.canonicalName` is what lib/coaching/data.ts's
 * `fetchExerciseIdsByCanonicalName` uses as an EXACT-match key against the
 * real `exercises.name` column (see matching.ts's docstring — that lookup is
 * a plain, case-sensitive object-key lookup, NOT `resolveExerciseId`'s
 * case-insensitive fallback). Any `canonicalName` that doesn't match a real
 * catalog entry byte-for-byte falls through to `unresolvedExerciseId`, whose
 * `unresolved:<name>` sentinel then gets fed into a Supabase `.in('id', ...)`
 * filter and 400s (not a valid UUID) — for every session that includes that
 * exercise.
 *
 * `lib/exercises.json` (via `ALL_EXERCISES`) is the deterministic,
 * network-free stand-in for the real `exercises` table here: it's the exact
 * seed source (scripts/seed-program-exercises.ts upserts `name: ex.name`
 * verbatim, keyed on the UNIQUE `name` column), so a name that exists in the
 * bundled catalog is guaranteed to exist in the DB with identical casing.
 *
 * All programs registered in lib/routines.ts (not just the PPL default) are
 * checked — a mismatch in a less-used program (Wendler, PHUL, etc.) still
 * 400s the moment a session includes it, it's just less likely to have been
 * noticed yet.
 */

const PROGRAM_IDS = [
  'ppl-default',
  'wendler-531',
  'upper-lower',
  'full-body-3x',
  'stronglifts-5x5',
  'gzclp',
  'phul',
]

const catalogNames = new Set(ALL_EXERCISES.map(ex => ex.name))

describe('lib/routines.ts canonicalName consistency vs. the real exercise catalog', () => {
  for (const programId of PROGRAM_IDS) {
    const exercises = getAllExercisesForProgram(programId)

    it(`"${programId}" has at least one exercise (sanity check the program id is real)`, () => {
      expect(exercises.length).toBeGreaterThan(0)
    })

    for (const ex of exercises) {
      it(`"${programId}" / "${ex.name}": canonicalName "${ex.canonicalName}" resolves to a real catalog entry`, () => {
        expect(catalogNames.has(ex.canonicalName)).toBe(true)
      })
    }
  }
})
