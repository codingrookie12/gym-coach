import { describe, it, expect } from 'vitest'
import { wireRoutineToMuscles, buildExerciseMuscleMap } from '../muscleTagging'

const CATALOG = [
  { id: 'db-uuid-bench', name: 'Barbell Bench Press', primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps', 'Shoulders'] },
  { id: 'db-uuid-curl', name: 'Custom Cable Curl (Low Pulley)', primaryMuscles: ['Biceps'], secondaryMuscles: [] },
]

const ROUTINE = [
  { name: 'Barbell Bench Press', canonicalName: 'Barbell Bench Press', repRange: [6, 8] as [number, number] },
  { name: 'Some Brand New Custom Exercise', canonicalName: 'Some Brand New Custom Exercise', repRange: [8, 12] as [number, number] },
]

describe('wireRoutineToMuscles', () => {
  it('attaches catalog muscle data to a routine exercise resolved by canonicalName', () => {
    const { wired } = wireRoutineToMuscles(ROUTINE, CATALOG, { 'Barbell Bench Press': 'db-uuid-bench' })
    const bench = wired.find(w => w.exerciseName === 'Barbell Bench Press')!
    expect(bench.exerciseId).toBe('db-uuid-bench')
    expect(bench.primaryMuscles).toEqual(['Chest'])
    expect(bench.secondaryMuscles).toEqual(['Triceps', 'Shoulders'])
  })

  it('surfaces exercises that could not be resolved against the catalog rather than silently dropping them (the GYM-92 failure mode)', () => {
    const { wired, unresolved } = wireRoutineToMuscles(ROUTINE, CATALOG, {})
    expect(unresolved).toContain('Some Brand New Custom Exercise')
    const custom = wired.find(w => w.exerciseName === 'Some Brand New Custom Exercise')!
    expect(custom.primaryMuscles).toEqual([])
    expect(custom.secondaryMuscles).toEqual([])
    // still gets a stable (synthetic, clearly-marked) id — never silently omitted from the plan
    expect(custom.exerciseId).toMatch(/^unresolved:/)
  })

  it('uses the real DB id when a resolution map is provided, never the synthetic placeholder', () => {
    const { wired } = wireRoutineToMuscles(ROUTINE, CATALOG, {
      'Barbell Bench Press': 'db-uuid-bench',
      'Some Brand New Custom Exercise': 'db-uuid-custom-123',
    })
    expect(wired.every(w => !w.exerciseId.startsWith('unresolved:'))).toBe(true)
  })
})

describe('buildExerciseMuscleMap', () => {
  it('builds an exerciseId-keyed map suitable for volume tallying', () => {
    const { wired } = wireRoutineToMuscles(ROUTINE, CATALOG, { 'Barbell Bench Press': 'db-uuid-bench' })
    const map = buildExerciseMuscleMap(wired)
    expect(map['db-uuid-bench']).toEqual({ primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps', 'Shoulders'] })
  })
})
