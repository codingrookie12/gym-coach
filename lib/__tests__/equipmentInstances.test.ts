import { describe, it, expect } from 'vitest'
import {
  rowToInstance,
  resolveInstanceMass,
  resolveInstanceCreateErrorMessage,
  EquipmentInstanceNameTakenError,
} from '../equipmentInstances'

/**
 * lib/equipmentInstances.ts's CRUD functions (getEquipmentInstances,
 * createEquipmentInstance, updateEquipmentInstanceCalibration,
 * deleteEquipmentInstance) make live Supabase calls and have no rendering/
 * network-mocking harness in this repo (consistent with lib/customExercises.ts
 * and other Supabase-backed lib modules — see lib/__tests__/*.test.ts, none
 * of which mock createSupabaseBrowserClient). This file tests every PURE
 * piece of the module instead: the row-mapping function, the calibration
 * resolution helper, and the error-to-message mapping — the same scope
 * boundary this repo's existing tests draw around Supabase-backed modules.
 */

describe('rowToInstance', () => {
  it('maps a calibrated row to a populated calibration object', () => {
    const instance = rowToInstance({
      id: 'inst-1',
      user_id: 'user-1',
      name: "Gold's Gym — leg press",
      weight_per_unit: 50,
      weight_per_unit_mass_unit: 'lbs',
      created_at: '2026-09-01T00:00:00Z',
    })
    expect(instance).toEqual({
      id: 'inst-1',
      userId: 'user-1',
      name: "Gold's Gym — leg press",
      calibration: { weightPerUnit: 50, weightPerUnitMassUnit: 'lbs' },
      createdAt: '2026-09-01T00:00:00Z',
    })
  })

  it('maps an uncalibrated row (both columns null) to a null calibration', () => {
    const instance = rowToInstance({
      id: 'inst-2',
      user_id: 'user-1',
      name: 'Planet Fitness',
      weight_per_unit: null,
      weight_per_unit_mass_unit: null,
      created_at: '2026-09-01T00:00:00Z',
    })
    expect(instance.calibration).toBeNull()
  })

  it('treats a partially-null row (should never happen given the DB pair CHECK) as uncalibrated, not a crash', () => {
    const instance = rowToInstance({
      id: 'inst-3',
      user_id: 'user-1',
      name: 'Anywhere Gym',
      weight_per_unit: 50,
      weight_per_unit_mass_unit: null,
      created_at: '2026-09-01T00:00:00Z',
    })
    expect(instance.calibration).toBeNull()
  })
})

describe('resolveInstanceMass', () => {
  const calibratedInstance = rowToInstance({
    id: 'inst-1',
    user_id: 'user-1',
    name: "Gold's Gym — leg press",
    weight_per_unit: 50,
    weight_per_unit_mass_unit: 'lbs',
    created_at: '2026-09-01T00:00:00Z',
  })

  const uncalibratedInstance = rowToInstance({
    id: 'inst-2',
    user_id: 'user-1',
    name: 'Planet Fitness',
    weight_per_unit: null,
    weight_per_unit_mass_unit: null,
    created_at: '2026-09-01T00:00:00Z',
  })

  it('resolves a pin count to real mass for a calibrated instance', () => {
    expect(resolveInstanceMass(calibratedInstance, 5, 'lbs')).toBe(250)
  })

  it('converts the resolved mass to the requested target unit', () => {
    const kgResult = resolveInstanceMass(calibratedInstance, 5, 'kg')
    expect(kgResult).not.toBeNull()
    expect(kgResult!).toBeCloseTo(250 / 2.20462, 5)
  })

  it('returns null for an uncalibrated instance — never guesses a mass', () => {
    expect(resolveInstanceMass(uncalibratedInstance, 5, 'lbs')).toBeNull()
  })
})

describe('resolveInstanceCreateErrorMessage', () => {
  it('gives a specific, actionable message for a name-taken error', () => {
    const err = new EquipmentInstanceNameTakenError("Gold's Gym")
    expect(resolveInstanceCreateErrorMessage(err, "Gold's Gym")).toBe(
      '"Gold\'s Gym" already exists — pick it from the list above instead.'
    )
  })

  it('falls back to a generic connectivity message for any other error', () => {
    expect(resolveInstanceCreateErrorMessage(new Error('network down'), 'Test Gym')).toBe(
      'Could not add — check your connection and try again.'
    )
    expect(resolveInstanceCreateErrorMessage('not even an Error instance', 'Test Gym')).toBe(
      'Could not add — check your connection and try again.'
    )
  })
})
