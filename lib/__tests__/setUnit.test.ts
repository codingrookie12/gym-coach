import { describe, it, expect } from 'vitest'
import { resolvePersistedUnit, weightUnitLabelKey, nextMassUnit, resolveActiveMassUnit } from '../setUnit'

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

describe('weightUnitLabelKey', () => {
  it('maps lowercase and DB-capitalized forms to the same i18n key', () => {
    expect(weightUnitLabelKey('lbs')).toBe('lbs')
    expect(weightUnitLabelKey('Lbs')).toBe('lbs')
    expect(weightUnitLabelKey('kg')).toBe('kg')
    expect(weightUnitLabelKey('Kg')).toBe('kg')
    expect(weightUnitLabelKey('pins')).toBe('pins')
    expect(weightUnitLabelKey('Pins')).toBe('pins')
  })

  it('defaults unrecognized/missing values to lbs (matches every prior call site fallback)', () => {
    expect(weightUnitLabelKey(undefined)).toBe('lbs')
    expect(weightUnitLabelKey(null)).toBe('lbs')
  })
})

describe('nextMassUnit', () => {
  it('toggles lbs <-> kg and never produces pins', () => {
    expect(nextMassUnit('lbs')).toBe('kg')
    expect(nextMassUnit('kg')).toBe('lbs')
  })
})

describe('resolveActiveMassUnit', () => {
  it('prefers the current session override above everything else', () => {
    expect(resolveActiveMassUnit('kg', 'Lbs', 'lbs')).toBe('kg')
    expect(resolveActiveMassUnit('lbs', 'Kg', 'kg')).toBe('lbs')
  })

  it('regression: a resumed session with no session override yet, but a log already carrying a prior toggle\'s resolved unit, keeps showing that unit rather than relabeling already-converted kg numbers as Lbs', () => {
    expect(resolveActiveMassUnit(undefined, 'Kg', 'lbs')).toBe('kg')
    expect(resolveActiveMassUnit(undefined, 'Lbs', 'lbs')).toBe('lbs')
  })

  it('falls back to the routine default when neither a session override nor a log unit exists yet (brand-new exercise, never touched)', () => {
    expect(resolveActiveMassUnit(undefined, undefined, 'kg')).toBe('kg')
    expect(resolveActiveMassUnit(undefined, null, undefined)).toBe('lbs')
  })

  it('a legacy/abstract "Pins" log unit on a mass-based exercise (should not normally happen) does not leak through — falls back to the routine default', () => {
    expect(resolveActiveMassUnit(undefined, 'Pins', 'kg')).toBe('kg')
  })
})
