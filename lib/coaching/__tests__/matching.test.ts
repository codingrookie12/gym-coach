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

  // GYM-97 fix #3: two independently added/swapped plan items sharing a
  // name (e.g. two mid-session quick-adds both named "Cable Curl") must
  // not collide on exerciseId — that corrupts React keys and the
  // weightDecisions/onWeightDecision map in app/page.tsx, which key off it.
  it('does not collide for two same-named instances when a per-instance salt is passed', () => {
    const first = unresolvedExerciseId('Cable Curl', 'salt-1')
    const second = unresolvedExerciseId('Cable Curl', 'salt-2')
    expect(first).not.toBe(second)
    expect(isUnresolvedExerciseId(first)).toBe(true)
    expect(isUnresolvedExerciseId(second)).toBe(true)
  })

  it('still collides on a bare call with no salt (documents why callers that mint one per instance must pass one)', () => {
    expect(unresolvedExerciseId('Cable Curl')).toBe(unresolvedExerciseId('Cable Curl'))
  })
})
