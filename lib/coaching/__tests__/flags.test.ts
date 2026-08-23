import { describe, it, expect } from 'vitest'
import { buildFlag, pickStallStrategy } from '../flags'

describe('pickStallStrategy', () => {
  it('rotates through the four strategy kinds by index (replaces the old hardcoded English strategies array)', () => {
    expect(pickStallStrategy(0)).toBe('drop-set')
    expect(pickStallStrategy(1)).toBe('pause-reps')
    expect(pickStallStrategy(2)).toBe('grip-angle')
    expect(pickStallStrategy(3)).toBe('deload')
    expect(pickStallStrategy(4)).toBe('drop-set') // wraps around
  })

  it('never returns a formatted English string', () => {
    for (let i = 0; i < 8; i++) {
      const kind = pickStallStrategy(i)
      expect(kind).not.toMatch(/\s/) // a real kind is a single hyphenated token, never a sentence
    }
  })
})

describe('buildFlag', () => {
  it('produces a locale-agnostic structured flag with no message string field', () => {
    const flag = buildFlag({
      kind: 'stall',
      scope: 'exercise',
      exerciseId: 'ex-1',
      date: '2026-08-22',
      params: { sessionCount: 3, strategyKind: 'drop-set' },
      origin: 'structural',
      landmarksVersion: 1,
      setCreditingVersion: 1,
    })
    expect(flag).not.toHaveProperty('message')
    expect(typeof flag.kind).toBe('string')
    expect(flag.params).toEqual({ sessionCount: 3, strategyKind: 'drop-set' })
  })

  it('every param value is a primitive, never a nested formatted string with interpolation', () => {
    const flag = buildFlag({
      kind: 'progress-ready',
      scope: 'exercise',
      exerciseId: 'ex-1',
      date: '2026-08-22',
      params: { fromWeight: 100, toWeight: 105, topOfRange: 12 },
      origin: 'logged-rir',
      landmarksVersion: 1,
      setCreditingVersion: 1,
    })
    for (const value of Object.values(flag.params)) {
      expect(['string', 'number', 'boolean']).toContain(typeof value === 'object' ? 'object' : typeof value)
      if (typeof value === 'string') {
        // a real locale-agnostic param is a short token/id, not a rendered sentence
        expect(value.split(' ').length).toBeLessThanOrEqual(3)
      }
    }
  })

  it('builds a stable, collision-resistant id from scope/target/kind/date', () => {
    const flag = buildFlag({
      kind: 'fatigue',
      scope: 'exercise',
      exerciseId: 'ex-1',
      date: '2026-08-22',
      params: {},
      origin: 'structural',
      landmarksVersion: 1,
      setCreditingVersion: 1,
    })
    expect(flag.id).toBe('exercise:ex-1:fatigue:2026-08-22')
  })

  it('stamps the landmark and set-crediting version snapshot on every flag, even non-volume ones', () => {
    const flag = buildFlag({
      kind: 'weight-too-heavy',
      scope: 'exercise',
      exerciseId: 'ex-1',
      date: '2026-08-22',
      params: {},
      origin: 'structural',
      landmarksVersion: 3,
      setCreditingVersion: 2,
    })
    expect(flag.landmarksVersion).toBe(3)
    expect(flag.setCreditingVersion).toBe(2)
  })
})
