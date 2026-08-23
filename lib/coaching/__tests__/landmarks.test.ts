import { describe, it, expect } from 'vitest'
import { DEFAULT_LANDMARKS, DEFAULT_LANDMARKS_VERSION, DEFAULT_SET_CREDITING_RULE, getLandmark } from '../landmarks'

describe('DEFAULT_LANDMARKS', () => {
  it('has all three experience-level tiers for every muscle group', () => {
    const groups = Array.from(new Set(DEFAULT_LANDMARKS.map(l => l.muscleGroup)))
    for (const group of groups) {
      const tiers = DEFAULT_LANDMARKS.filter(l => l.muscleGroup === group).map(l => l.experienceLevel)
      expect(tiers.sort()).toEqual(['advanced', 'intermediate', 'novice'])
    }
  })

  it('always has mev <= mav <= mrv (the DB CHECK constraint this mirrors)', () => {
    for (const l of DEFAULT_LANDMARKS) {
      expect(l.mev).toBeLessThanOrEqual(l.mav)
      expect(l.mav).toBeLessThanOrEqual(l.mrv)
    }
  })

  it('scales novice below and advanced above the intermediate base for every muscle group', () => {
    const groups = Array.from(new Set(DEFAULT_LANDMARKS.map(l => l.muscleGroup)))
    for (const group of groups) {
      const novice = getLandmark(DEFAULT_LANDMARKS, group, 'novice')!
      const intermediate = getLandmark(DEFAULT_LANDMARKS, group, 'intermediate')!
      const advanced = getLandmark(DEFAULT_LANDMARKS, group, 'advanced')!
      expect(novice.mav).toBeLessThanOrEqual(intermediate.mav)
      expect(advanced.mav).toBeGreaterThanOrEqual(intermediate.mav)
    }
  })

  it('every landmark carries a non-empty source citation (traceability requirement)', () => {
    for (const l of DEFAULT_LANDMARKS) {
      expect(l.sourceCitation.length).toBeGreaterThan(0)
    }
  })

  it('is versioned consistently', () => {
    expect(DEFAULT_LANDMARKS.every(l => l.version === DEFAULT_LANDMARKS_VERSION)).toBe(true)
  })
})

describe('DEFAULT_SET_CREDITING_RULE', () => {
  it('credits secondary muscle involvement at less than primary, per RP convention', () => {
    expect(DEFAULT_SET_CREDITING_RULE.secondaryCredit).toBeLessThan(DEFAULT_SET_CREDITING_RULE.primaryCredit)
    expect(DEFAULT_SET_CREDITING_RULE.primaryCredit).toBe(1.0)
    expect(DEFAULT_SET_CREDITING_RULE.secondaryCredit).toBe(0.5)
  })
})

describe('landmarks are swappable via config with zero code changes (Phase 2 exit criterion)', () => {
  it('an alternate landmark preset changes buildMuscleVolumeStatus output without touching any engine code', async () => {
    const { buildMuscleVolumeStatus } = await import('../volume')

    const session = {
      workoutId: 'w1',
      date: '2026-08-22',
      sessionRpe: null,
      exercises: {
        bench: {
          sets: [
            { setNumber: 1, weight: 100, reps: 8, rir: 2 },
            { setNumber: 2, weight: 100, reps: 8, rir: 2 },
            { setNumber: 3, weight: 100, reps: 8, rir: 2 },
          ],
        },
      },
    }
    const muscles = { bench: { primaryMuscles: ['Chest'], secondaryMuscles: [] } }

    const stockPreset = [
      { muscleGroup: 'Chest', experienceLevel: 'intermediate' as const, version: 1, mev: 8, mav: 16, mrv: 22, sourceCitation: 'stock' },
    ]
    const alternatePreset = [
      // an alternate config, e.g. a population-tuned preset for a future
      // cohort — same shape, only the numbers differ.
      { muscleGroup: 'Chest', experienceLevel: 'intermediate' as const, version: 2, mev: 0, mav: 1, mrv: 2, sourceCitation: 'alternate' },
    ]

    const stockResult = buildMuscleVolumeStatus([session], muscles, '2026-08-22', 'intermediate', stockPreset, DEFAULT_SET_CREDITING_RULE)
    const alternateResult = buildMuscleVolumeStatus([session], muscles, '2026-08-22', 'intermediate', alternatePreset, DEFAULT_SET_CREDITING_RULE)

    // Same 1 logged set both times — under the stock preset it reads as
    // under-target (MEV 8), under the alternate preset the same single set
    // already exceeds MRV. Zero code changed between the two calls.
    expect(stockResult[0].zone).toBe('under-mev')
    expect(alternateResult[0].zone).toBe('over-mrv')
    expect(alternateResult[0].landmarksVersion).toBe(2)
  })
})
