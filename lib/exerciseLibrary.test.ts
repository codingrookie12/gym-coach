/**
 * Coverage for the swap-to-full-browser UX fix (Johnnatan feedback:
 * mid-workout swap only offered 3 alternatives with no escape hatch).
 * ActiveSessionScreen and WorkoutOverviewScreen now open ExercisePickerSheet
 * — a full search/browse sheet — as an additive "browse all exercises"
 * affordance from the swap panel. `excludeOtherSessionNames` computes the
 * sheet's `excludeNames`: every exercise already elsewhere in today's
 * session/plan should be disabled to prevent picking a duplicate, EXCEPT
 * the item actively being swapped (reselecting it is a harmless no-op, not
 * a duplicate) — mirroring RoutineEditorScreen's existing picker-exclude
 * convention.
 */
import { describe, it, expect } from 'vitest'
import { excludeOtherSessionNames, findExerciseByName, filterExercises } from './exerciseLibrary'

describe('excludeOtherSessionNames', () => {
  it('excludes every other name but not the one being swapped', () => {
    const names = ['Barbell Bench Press', 'Barbell Back Squat', 'Lat Pulldown']
    expect(excludeOtherSessionNames(names, 1)).toEqual(['Barbell Bench Press', 'Lat Pulldown'])
  })

  it('excludes nothing when swapping the only exercise in the session', () => {
    expect(excludeOtherSessionNames(['Barbell Bench Press'], 0)).toEqual([])
  })

  it('drops null/undefined/empty entries (mid-session custom-add rows still resolving)', () => {
    const names: (string | null | undefined)[] = ['Barbell Bench Press', null, undefined, '', 'Cable Row']
    expect(excludeOtherSessionNames(names, 0)).toEqual(['Cable Row'])
  })

  it('returns every other name unchanged when skipIndex is out of range', () => {
    const names = ['Barbell Bench Press', 'Cable Row']
    expect(excludeOtherSessionNames(names, 99)).toEqual(names)
  })

  it('handles an empty session', () => {
    expect(excludeOtherSessionNames([], 0)).toEqual([])
  })
})

// Sanity checks for the two library entry points the new "browse all
// exercises" affordance relies on end-to-end: searching finds real results,
// and searching for nothing returns an empty (not throwing) result set —
// the sheet's own empty-state path.
describe('full-library browse/search path used by the swap picker', () => {
  it('finds real exercises for a plausible query', () => {
    const results = filterExercises({ query: 'squat' })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(ex => ex.name.toLowerCase().includes('squat'))).toBe(true)
  })

  it('returns no results for a nonsense query instead of throwing', () => {
    const results = filterExercises({ query: 'zzzznotarealexercisezzzz' })
    expect(results).toEqual([])
  })

  it('resolves the swap target back to its full definition for the sheet header', () => {
    const def = findExerciseByName('Barbell Squat')
    expect(def?.name).toBe('Barbell Squat')
  })
})
