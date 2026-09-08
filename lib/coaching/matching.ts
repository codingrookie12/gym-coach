/**
 * lib/coaching/matching.ts
 *
 * Exercise-identity resolution — the systemic fix for GYM-92's root cause.
 *
 * The old engine (lib/coaching.ts:matchesExercise) compared two
 * independently-sourced display-name strings case-insensitively, at
 * aggregation time, repeated per session per exercise. That's fragile in two
 * compounding ways: (1) a routine's `Exercise.name` (display label) can
 * differ from its own `Exercise.canonicalName` (e.g. "Standing Low-pulley
 * One-arm Triceps Extension" vs. "Standing Low-Pulley One-Arm Triceps
 * Extension" — a real pair in lib/routines.ts today, differing only in
 * case, which `.toLowerCase()` happens to still catch — but nothing
 * guarantees a future custom-exercise name only differs by case); (2) a
 * custom exercise's name, as typed by whichever user created it, has no
 * guaranteed relationship to the DB's canonical `exercises.name` at all.
 *
 * The fix: resolve each exercise to its stable `exercises.id` (DB UUID,
 * FK'd from `sets.exercise_id`) exactly ONCE, at the routine/catalog-wiring
 * boundary (see muscleTagging.ts), via the one guaranteed-unique anchor —
 * `exercises.name` (the seed-script upsert key, confirmed UNIQUE in
 * 20260423000000_initial_schema.sql, and per Section 5 of the plan,
 * English-canonical forever). Everything downstream of that one resolution
 * — session aggregation, volume tallying, weight-override lookup — is then a
 * plain object-key lookup by UUID, never a string comparison again.
 */

export interface MatchableCatalogEntry {
  id: string
  name: string
}

/**
 * Resolves a routine exercise's stable identity against a catalog of
 * {id, name} pairs. Exact match first (the guaranteed-correct path, since
 * `exercises.name` is UNIQUE and canonical). Case-insensitive fallback exists
 * only to catch pre-existing casing drift within this codebase's own data
 * (like the Standing Low-Pulley example above) — it is never used as a fuzzy
 * "close enough" matcher, and callers should treat a fallback match as worth
 * logging/flagging, not silently trusting forever.
 */
export function resolveExerciseId(
  catalog: MatchableCatalogEntry[],
  canonicalName: string
): { id: string; matchedVia: 'exact' | 'case-insensitive' } | null {
  const exact = catalog.find(c => c.name === canonicalName)
  if (exact) return { id: exact.id, matchedVia: 'exact' }

  const normalized = canonicalName.trim().toLowerCase()
  const caseInsensitive = catalog.find(c => c.name.trim().toLowerCase() === normalized)
  if (caseInsensitive) return { id: caseInsensitive.id, matchedVia: 'case-insensitive' }

  return null
}

/** Stable placeholder id for a routine exercise that couldn't be resolved
 *  against any real DB row (e.g. a static template preview rendered before
 *  the user has cloned the program, so no `exercises` query has run yet).
 *  Deliberately prefixed and never equal to a real UUID, so any code path
 *  that accidentally treats it as a real exercise_id fails loudly (a UUID FK
 *  lookup against `unresolved:...` will simply never match a row) rather
 *  than silently corrupting data.
 *
 *  GYM-97 fix #3: a pure lowercased-name hash collides whenever two
 *  independently added/swapped plan items share a name (e.g. two mid-session
 *  quick-adds both named "Cable Curl"), corrupting React keys and the
 *  `weightDecisions`/`onWeightDecision` map in app/page.tsx, which key off
 *  this id. Callers that mint one per plan-item *instance* (session swap,
 *  mid-session add) should pass a per-instance `instanceSalt` (e.g.
 *  `crypto.randomUUID()`) to guarantee uniqueness even for same-named
 *  items. Omitted for backward-compat call sites that only need a stable,
 *  human-readable placeholder (no risk of a same-name collision there). */
export function unresolvedExerciseId(canonicalName: string, instanceSalt?: string): string {
  const base = `unresolved:${canonicalName.trim().toLowerCase()}`
  return instanceSalt ? `${base}:${instanceSalt}` : base
}

export function isUnresolvedExerciseId(id: string): boolean {
  return id.startsWith('unresolved:')
}
