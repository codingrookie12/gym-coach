import { describe, it, expect } from 'vitest'
import { inferRirFromRepRange, resolveRir, combineProvenance, averageRir } from '../rir'

describe('inferRirFromRepRange', () => {
  it('infers low RIR (near failure) at the top of the rep range', () => {
    expect(inferRirFromRepRange(12, [8, 12])).toBe(1)
    expect(inferRirFromRepRange(15, [8, 12])).toBe(1) // exceeding top still clamps to 1, not negative
  })

  it('infers higher RIR (more left in the tank) at the bottom of the rep range', () => {
    expect(inferRirFromRepRange(8, [8, 12])).toBe(3)
  })

  it('interpolates linearly in between, rounded', () => {
    expect(inferRirFromRepRange(10, [8, 12])).toBe(2)
  })

  it('never returns a value outside the 0-5 domain', () => {
    expect(inferRirFromRepRange(0, [8, 12])).toBeGreaterThanOrEqual(0)
    expect(inferRirFromRepRange(100, [8, 12])).toBeLessThanOrEqual(5)
  })

  it('degrades gracefully for a degenerate rep range', () => {
    expect(inferRirFromRepRange(10, [10, 10])).toBe(2)
  })
})

describe('resolveRir', () => {
  it('uses the logged value and tags it logged-rir when present', () => {
    const reading = resolveRir(2, 10, [8, 12])
    expect(reading).toEqual({ value: 2, origin: 'logged-rir' })
  })

  it('treats RIR 0 as a real logged value, not "missing"', () => {
    const reading = resolveRir(0, 10, [8, 12])
    expect(reading).toEqual({ value: 0, origin: 'logged-rir' })
  })

  it('falls back to rep-range inference and tags inferred-rep-range when RIR is null', () => {
    const reading = resolveRir(null, 12, [8, 12])
    expect(reading.origin).toBe('inferred-rep-range')
    expect(reading.value).toBe(1)
  })

  it('clamps an out-of-domain logged value defensively', () => {
    expect(resolveRir(9, 10, [8, 12]).value).toBe(5)
    expect(resolveRir(-3, 10, [8, 12]).value).toBe(0)
  })
})

describe('combineProvenance', () => {
  it('is logged-rir only when every reading is logged', () => {
    expect(
      combineProvenance([
        { value: 2, origin: 'logged-rir' },
        { value: 1, origin: 'logged-rir' },
      ])
    ).toBe('logged-rir')
  })

  it('degrades to inferred-rep-range if any reading was inferred (never silently upgraded)', () => {
    expect(
      combineProvenance([
        { value: 2, origin: 'logged-rir' },
        { value: 1, origin: 'inferred-rep-range' },
      ])
    ).toBe('inferred-rep-range')
  })

  it('is logged-rir for an empty list (vacuously true, no inferred reading present)', () => {
    expect(combineProvenance([])).toBe('logged-rir')
  })
})

describe('averageRir', () => {
  it('averages a list of readings', () => {
    expect(
      averageRir([
        { value: 2, origin: 'logged-rir' },
        { value: 4, origin: 'logged-rir' },
      ])
    ).toBe(3)
  })

  it('returns null for an empty list', () => {
    expect(averageRir([])).toBeNull()
  })
})
