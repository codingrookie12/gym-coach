import { describe, it, expect } from 'vitest'
import { resolveExerciseId, unresolvedExerciseId, isUnresolvedExerciseId } from '../matching'

const CATALOG = [
  { id: 'uuid-1', name: 'Barbell Bench Press' },
  { id: 'uuid-2', name: 'Standing Low-Pulley One-Arm Triceps Extension' },
]

describe('resolveExerciseId', () => {
  it('resolves an exact name match', () => {
    expect(resolveExerciseId(CATALOG, 'Barbell Bench Press')).toEqual({ id: 'uuid-1', matchedVia: 'exact' })
  })

  it('falls back to a case-insensitive match for known casing drift (the real Standing Low-Pulley case)', () => {
    expect(resolveExerciseId(CATALOG, 'Standing Low-pulley One-arm Triceps Extension')).toEqual({
      id: 'uuid-2',
      matchedVia: 'case-insensitive',
    })
  })

  it('returns null when nothing matches, rather than guessing a close-enough exercise', () => {
    expect(resolveExerciseId(CATALOG, 'Some Totally Different Exercise')).toBeNull()
  })
})

describe('unresolvedExerciseId', () => {
  it('produces a stable, clearly-marked placeholder', () => {
    expect(unresolvedExerciseId('Custom Thing')).toBe('unresolved:custom thing')
    expect(isUnresolvedExerciseId(unresolvedExerciseId('Custom Thing'))).toBe(true)
  })

  it('never collides with a real UUID shape', () => {
    expect(isUnresolvedExerciseId('uuid-1')).toBe(false)
  })
})
