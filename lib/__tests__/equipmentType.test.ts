import { describe, it, expect } from 'vitest'
import {
  resolveEquipmentType,
  matchesInstance,
  pickWeightOverride,
  familyForKind,
  type EquipmentKind,
} from '../equipmentType'

describe('familyForKind', () => {
  it('classifies pin-stack machines and bands as abstract-scale', () => {
    expect(familyForKind('pin-stack-machine')).toBe('abstract-scale')
    expect(familyForKind('band')).toBe('abstract-scale')
  })

  it('classifies every other kind as mass-based', () => {
    const massBasedKinds: EquipmentKind[] = [
      'barbell',
      'dumbbell',
      'plate-loaded-machine',
      'cable-stack',
      'bodyweight',
      'other',
    ]
    for (const kind of massBasedKinds) {
      expect(familyForKind(kind)).toBe('mass-based')
    }
  })
})

describe('resolveEquipmentType', () => {
  it('an explicit equipmentType always wins over any fallback signal', () => {
    expect(resolveEquipmentType({ equipmentType: 'abstract-scale', weightUnit: 'lbs', equipment: 'Barbell' }))
      .toBe('abstract-scale')
    expect(resolveEquipmentType({ equipmentType: 'mass-based', weightUnit: 'pins', equipment: 'Bands' }))
      .toBe('mass-based')
  })

  it('falls back to the routine-level weightUnit === "pins" signal (pin-stack exercises)', () => {
    expect(resolveEquipmentType({ weightUnit: 'pins' })).toBe('abstract-scale')
    expect(resolveEquipmentType({ weightUnit: 'lbs' })).toBe('mass-based')
    expect(resolveEquipmentType({ weightUnit: 'kg' })).toBe('mass-based')
  })

  it('falls back to the catalog equipment tag "Bands" when no other signal is present', () => {
    expect(resolveEquipmentType({ equipment: 'Bands' })).toBe('abstract-scale')
    expect(resolveEquipmentType({ equipment: 'Barbell' })).toBe('mass-based')
  })

  it('defaults to mass-based when nothing is known — preserves pre-change behavior for untouched exercises', () => {
    expect(resolveEquipmentType({})).toBe('mass-based')
  })

  it('a null equipmentType is treated as absent, not an explicit choice', () => {
    expect(resolveEquipmentType({ equipmentType: null, weightUnit: 'pins' })).toBe('abstract-scale')
  })
})

describe('matchesInstance', () => {
  it('two untagged (null/undefined) values match — "same default machine as before"', () => {
    expect(matchesInstance(null, null)).toBe(true)
    expect(matchesInstance(undefined, null)).toBe(true)
    expect(matchesInstance(undefined, undefined)).toBe(true)
  })

  it('the same real tag matches itself', () => {
    expect(matchesInstance('golds-gym', 'golds-gym')).toBe(true)
  })

  it('two different real tags do not match — different gyms are not comparable', () => {
    expect(matchesInstance('golds-gym', 'planet-fitness')).toBe(false)
  })

  it('a tagged value never matches an untagged one, in either direction', () => {
    expect(matchesInstance('golds-gym', null)).toBe(false)
    expect(matchesInstance(null, 'golds-gym')).toBe(false)
    expect(matchesInstance('golds-gym', undefined)).toBe(false)
  })
})

describe('pickWeightOverride', () => {
  it('returns null with no entries at all', () => {
    expect(pickWeightOverride([], 'gym-a', 'abstract-scale')).toBeNull()
    expect(pickWeightOverride([], null, 'mass-based')).toBeNull()
  })

  it('abstract-scale: an exact instance match wins over any other entry', () => {
    const entries = [
      { weight: 12, equipmentInstanceId: 'gym-a' },
      { weight: 20, equipmentInstanceId: 'gym-b' },
    ]
    expect(pickWeightOverride(entries, 'gym-a', 'abstract-scale')).toBe(12)
  })

  it('abstract-scale: a differently-tagged entry never counts, even with no untagged fallback', () => {
    const entries = [{ weight: 20, equipmentInstanceId: 'gym-b' }]
    expect(pickWeightOverride(entries, 'gym-a', 'abstract-scale')).toBeNull()
  })

  it('abstract-scale: a tagged context with only an untagged entry on file is a miss — NO substitution', () => {
    const entries = [
      { weight: 20, equipmentInstanceId: 'gym-b' },
      { weight: 15, equipmentInstanceId: null },
    ]
    expect(pickWeightOverride(entries, 'gym-a', 'abstract-scale')).toBeNull()
  })

  it('abstract-scale: an untagged plan never borrows a tagged machine\'s override', () => {
    const entries = [{ weight: 20, equipmentInstanceId: 'gym-a' }]
    expect(pickWeightOverride(entries, null, 'abstract-scale')).toBeNull()
  })

  it('abstract-scale: two untagged sides match directly (pre-change default-machine behavior)', () => {
    const entries = [{ weight: 15, equipmentInstanceId: null }]
    expect(pickWeightOverride(entries, null, 'abstract-scale')).toBe(15)
    expect(pickWeightOverride(entries, undefined, 'abstract-scale')).toBe(15)
  })

  it('mass-based: instance never gates the answer — a differently-tagged entry still counts', () => {
    const entries = [{ weight: 225, equipmentInstanceId: 'gym-b' }]
    expect(pickWeightOverride(entries, 'gym-a', 'mass-based')).toBe(225)
  })

  it('mass-based: prefers the untagged entry for stability when both exist', () => {
    const entries = [
      { weight: 225, equipmentInstanceId: 'gym-b' },
      { weight: 220, equipmentInstanceId: null },
    ]
    expect(pickWeightOverride(entries, 'gym-a', 'mass-based')).toBe(220)
  })

  it('unknown type (no catalog resolution yet, e.g. quick-add) behaves permissively like mass-based', () => {
    const entries = [{ weight: 95, equipmentInstanceId: 'gym-b' }]
    expect(pickWeightOverride(entries, null, 'unknown')).toBe(95)
    expect(pickWeightOverride(entries, null)).toBe(95) // default param
  })
})
