import { describe, it, expect } from 'vitest'
import { resolvePersistedUnit } from '../setUnit'

describe('resolvePersistedUnit', () => {
  it('uses the in-session log unit when present (mass-based)', () => {
    expect(resolvePersistedUnit('kg', 'lbs', 'mass-based')).toBe('Kg')
    expect(resolvePersistedUnit('lbs', 'kg', 'mass-based')).toBe('Lbs')
  })

  it('falls back to the routine default when the log has no unit yet (mass-based)', () => {
    expect(resolvePersistedUnit(undefined, 'kg', 'mass-based')).toBe('Kg')
    expect(resolvePersistedUnit(undefined, undefined, 'mass-based')).toBe('Lbs')
    expect(resolvePersistedUnit(null, 'kg', 'mass-based')).toBe('Kg')
  })

  it('abstract-scale always persists Pins, regardless of stale/legacy log or routine unit values', () => {
    expect(resolvePersistedUnit('lbs', 'lbs', 'abstract-scale')).toBe('Pins')
    expect(resolvePersistedUnit('kg', undefined, 'abstract-scale')).toBe('Pins')
    expect(resolvePersistedUnit(undefined, undefined, 'abstract-scale')).toBe('Pins')
  })

  it('mass-based never persists Pins even if a legacy value of "pins" is somehow present', () => {
    // Defensive: equipmentType is authoritative, not the stored string.
    expect(resolvePersistedUnit('pins' as any, undefined, 'mass-based')).toBe('Lbs')
  })
})
