import { describe, it, expect } from 'vitest'
import {
  LBS_PER_KG,
  lbsToKg,
  kgToLbs,
  convertMass,
  roundMass,
  convertPresetWeight,
  convertPresetLadder,
  formatWeightDisplay,
  convertAbstractUnitsToMass,
} from '../weightConversion'

describe('LBS_PER_KG / lbsToKg / kgToLbs', () => {
  it('uses the exact fixed conversion factor', () => {
    expect(LBS_PER_KG).toBe(2.20462)
  })

  it('kgToLbs converts 1 kg to the exact factor', () => {
    expect(kgToLbs(1)).toBeCloseTo(2.20462, 5)
  })

  it('lbsToKg converts the exact factor back to 1', () => {
    expect(lbsToKg(2.20462)).toBeCloseTo(1, 5)
  })

  it('matches known real-world reference points', () => {
    expect(kgToLbs(100)).toBeCloseTo(220.462, 3)
    expect(lbsToKg(220.462)).toBeCloseTo(100, 3)
    expect(kgToLbs(60)).toBeCloseTo(132.2772, 3)
  })

  it('round-trips lbs -> kg -> lbs back to the original value with no drift', () => {
    for (const original of [45, 100, 135, 225, 315, 0.5, 1000]) {
      expect(kgToLbs(lbsToKg(original))).toBeCloseTo(original, 9)
    }
  })

  it('round-trips kg -> lbs -> kg back to the original value with no drift', () => {
    for (const original of [20, 50, 60, 100, 140.5]) {
      expect(lbsToKg(kgToLbs(original))).toBeCloseTo(original, 9)
    }
  })

  it('handles zero without producing NaN or -0 surprises', () => {
    expect(lbsToKg(0)).toBe(0)
    expect(kgToLbs(0)).toBe(0)
  })
})

describe('convertMass', () => {
  it('is a no-op when from === to, returning the exact same value (no floating-point noise)', () => {
    expect(convertMass(100, 'lbs', 'lbs')).toBe(100)
    expect(convertMass(45, 'kg', 'kg')).toBe(45)
    expect(convertMass(0, 'kg', 'kg')).toBe(0)
  })

  it('converts lbs -> kg using the shared factor', () => {
    expect(convertMass(220.462, 'lbs', 'kg')).toBeCloseTo(100, 5)
  })

  it('converts kg -> lbs using the shared factor', () => {
    expect(convertMass(100, 'kg', 'lbs')).toBeCloseTo(220.462, 5)
  })
})

describe('roundMass', () => {
  it('snaps to the nearest standard 2.5-unit plate increment', () => {
    expect(roundMass(61.234)).toBe(60)
    expect(roundMass(1 / 3)).toBe(0)
    expect(roundMass(100)).toBe(100)
    expect(roundMass(2.268)).toBe(2.5)
  })

  it('rounds a value already exactly on a 2.5 increment to itself', () => {
    expect(roundMass(2.5)).toBe(2.5)
    expect(roundMass(45)).toBe(45)
    expect(roundMass(0)).toBe(0)
  })

  it('rounds down when below the increment midpoint', () => {
    expect(roundMass(46.1)).toBe(45)
  })

  it('rounds up when above the increment midpoint', () => {
    expect(roundMass(46.4)).toBe(47.5)
  })

  it('handles large weights without precision loss', () => {
    expect(roundMass(999.9)).toBe(1000)
  })
})

describe('convertPresetWeight — kg preset-grid conversion (regression coverage for the branch-documented ~2.2x data-corruption bug)', () => {
  it('converts an lbs-denominated preset to kg, snapped to a real loadable value', () => {
    // The historical bug: tapping "135" while toggled to kg used to write
    // { weight: 135, unit: 'kg' } — the raw lbs number relabeled as kg, a
    // silent ~2.2x overstatement. The correct behavior converts first.
    expect(convertPresetWeight(135, 'kg')).toBe(60)
    expect(convertPresetWeight(45, 'kg')).toBe(20)
  })

  it('is a no-op for lbs (the presets\' native unit) when already on a standard increment', () => {
    expect(convertPresetWeight(135, 'lbs')).toBe(135)
    expect(convertPresetWeight(45, 'lbs')).toBe(45)
  })

  it('snaps a small preset to the nearest standard increment after conversion', () => {
    expect(convertPresetWeight(5, 'kg')).toBe(2.5)
  })

  it('never returns the raw unconverted lbs number when converting to kg (the exact regression shape)', () => {
    const converted = convertPresetWeight(135, 'kg')
    expect(converted).not.toBe(135)
  })
})

describe('convertPresetLadder — regression coverage for the live-verification duplicate-chip bug', () => {
  it('reproduces the exact live-found collision: the barbell ladder\'s 25 and 30 lbs both round to 12.5 kg, and 80/85 both round to 37.5 kg — deduped to one chip each', () => {
    const BARBELL = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130, 140, 150]
    const converted = convertPresetLadder(BARBELL, 'kg')

    // No duplicates at all.
    expect(new Set(converted).size).toBe(converted.length)
    // The specific collisions found live are still present exactly once.
    expect(converted.filter(v => v === 12.5)).toHaveLength(1)
    expect(converted.filter(v => v === 37.5)).toHaveLength(1)
  })

  it('preserves ascending order (first-seen order matches input order for an already-sorted ladder)', () => {
    const ladder = [10, 20, 30, 40]
    const converted = convertPresetLadder(ladder, 'kg')
    const sorted = [...converted].sort((a, b) => a - b)
    expect(converted).toEqual(sorted)
  })

  it('is a no-op (values unchanged) for lbs, only dropping true duplicates if any existed in the source', () => {
    const ladder = [45, 90, 135]
    expect(convertPresetLadder(ladder, 'lbs')).toEqual([45, 90, 135])
  })

  it('never produces the raw unconverted lbs numbers when converting to kg', () => {
    const ladder = [135, 225]
    const converted = convertPresetLadder(ladder, 'kg')
    expect(converted).not.toContain(135)
    expect(converted).not.toContain(225)
  })

  it('handles an empty ladder', () => {
    expect(convertPresetLadder([], 'kg')).toEqual([])
  })
})

describe('formatWeightDisplay', () => {
  it('rounds to 1 decimal max', () => {
    expect(formatWeightDisplay(61.23)).toBe('61.2')
    expect(formatWeightDisplay(20.41)).toBe('20.4')
  })

  it('strips a trailing .0 for whole numbers', () => {
    expect(formatWeightDisplay(45.0)).toBe('45')
    expect(formatWeightDisplay(135)).toBe('135')
  })

  it('rounds a value that lands on a whole number after 1-decimal rounding', () => {
    expect(formatWeightDisplay(44.96)).toBe('45')
  })

  it('handles 0', () => {
    expect(formatWeightDisplay(0)).toBe('0')
  })
})

describe('convertAbstractUnitsToMass', () => {
  it('returns null when the instance has no calibration on file', () => {
    expect(convertAbstractUnitsToMass(5, null, 'lbs')).toBeNull()
  })

  it('resolves a calibrated pin count to real mass in the same unit', () => {
    // "one pin on this leg press = 50 lbs" -> pin 5 = 250 lbs
    const calibration = { weightPerUnit: 50, weightPerUnitMassUnit: 'lbs' as const }
    expect(convertAbstractUnitsToMass(5, calibration, 'lbs')).toBe(250)
  })

  it('resolves a calibrated pin count to real mass, converted to the requested target unit', () => {
    const calibration = { weightPerUnit: 50, weightPerUnitMassUnit: 'lbs' as const }
    expect(convertAbstractUnitsToMass(5, calibration, 'kg')).toBeCloseTo(convertMass(250, 'lbs', 'kg'), 9)
  })

  it('a kg-calibrated instance resolves correctly without conversion when target matches', () => {
    const calibration = { weightPerUnit: 10, weightPerUnitMassUnit: 'kg' as const }
    expect(convertAbstractUnitsToMass(3, calibration, 'kg')).toBe(30)
  })

  it('handles a zero unit count (e.g. pin removed) as zero mass, not null', () => {
    const calibration = { weightPerUnit: 50, weightPerUnitMassUnit: 'lbs' as const }
    expect(convertAbstractUnitsToMass(0, calibration, 'lbs')).toBe(0)
  })
})
