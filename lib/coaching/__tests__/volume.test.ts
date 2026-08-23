import { describe, it, expect } from 'vitest'
import { tallyWeeklyVolume, classifyZone, buildMuscleVolumeStatus, ExerciseMuscleMap } from '../volume'
import { CoachingSession, SetCreditingRule, TrainingLandmark } from '../types'

const CREDITING: SetCreditingRule = { version: 1, primaryCredit: 1.0, secondaryCredit: 0.5, sourceCitation: 'test' }

const MUSCLES: ExerciseMuscleMap = {
  bench: { primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps'] },
  curl: { primaryMuscles: ['Biceps'], secondaryMuscles: [] },
}

function session(date: string, exerciseId: string, setCount: number): CoachingSession {
  return {
    workoutId: `w-${date}`,
    date,
    sessionRpe: null,
    exercises: { [exerciseId]: { sets: Array.from({ length: setCount }, (_, i) => ({ setNumber: i + 1, weight: 100, reps: 10, rir: 2 })) } },
  }
}

describe('tallyWeeklyVolume', () => {
  it('credits primary muscles at 1.0x and secondary at 0.5x', () => {
    const totals = tallyWeeklyVolume([session('2026-08-20', 'bench', 4)], MUSCLES, '2026-08-22', CREDITING)
    expect(totals.get('Chest')).toBe(4) // primary: 4 sets * 1.0
    expect(totals.get('Triceps')).toBe(2) // secondary: 4 sets * 0.5
  })

  it('excludes sessions outside the 7-day window', () => {
    const totals = tallyWeeklyVolume([session('2026-08-01', 'bench', 4)], MUSCLES, '2026-08-22', CREDITING)
    expect(totals.get('Chest')).toBeUndefined()
  })

  it('skips exercises with no muscle-tag entry rather than crashing', () => {
    const totals = tallyWeeklyVolume([session('2026-08-22', 'untagged-exercise', 4)], MUSCLES, '2026-08-22', CREDITING)
    expect(totals.size).toBe(0)
  })

  it('sums across multiple sessions within the window', () => {
    const totals = tallyWeeklyVolume(
      [session('2026-08-19', 'curl', 3), session('2026-08-21', 'curl', 3)],
      MUSCLES,
      '2026-08-22',
      CREDITING
    )
    expect(totals.get('Biceps')).toBe(6)
  })
})

describe('classifyZone', () => {
  const landmark: TrainingLandmark = {
    muscleGroup: 'Chest',
    experienceLevel: 'intermediate',
    version: 1,
    mev: 8,
    mav: 16,
    mrv: 22,
    sourceCitation: 'test',
  }

  it('classifies under-mev, mev-mav, mav-mrv, and over-mrv correctly', () => {
    expect(classifyZone(4, landmark)).toBe('under-mev')
    expect(classifyZone(10, landmark)).toBe('mev-mav')
    expect(classifyZone(20, landmark)).toBe('mav-mrv')
    expect(classifyZone(25, landmark)).toBe('over-mrv')
  })

  it('treats the mev/mav/mrv boundaries themselves correctly', () => {
    expect(classifyZone(8, landmark)).toBe('mev-mav') // at MEV = met the floor
    expect(classifyZone(16, landmark)).toBe('mav-mrv') // at MAV = in the target band
    expect(classifyZone(22, landmark)).toBe('mav-mrv') // at MRV = still within, not yet over
  })
})

describe('buildMuscleVolumeStatus', () => {
  const landmarks: TrainingLandmark[] = [
    { muscleGroup: 'Chest', experienceLevel: 'intermediate', version: 1, mev: 8, mav: 16, mrv: 22, sourceCitation: 'x' },
    { muscleGroup: 'Biceps', experienceLevel: 'intermediate', version: 1, mev: 8, mav: 14, mrv: 20, sourceCitation: 'x' },
  ]

  it('shows a muscle group at 0 volume as under-mev rather than omitting it', () => {
    const statuses = buildMuscleVolumeStatus([], MUSCLES, '2026-08-22', 'intermediate', landmarks, CREDITING)
    const chest = statuses.find(s => s.muscleGroup === 'Chest')!
    expect(chest.weeklyCreditedSets).toBe(0)
    expect(chest.zone).toBe('under-mev')
  })

  it('stamps the landmark + set-crediting version on every status row', () => {
    const statuses = buildMuscleVolumeStatus([session('2026-08-22', 'bench', 4)], MUSCLES, '2026-08-22', 'intermediate', landmarks, CREDITING)
    const chest = statuses.find(s => s.muscleGroup === 'Chest')!
    expect(chest.landmarksVersion).toBe(1)
    expect(chest.setCreditingVersion).toBe(1)
  })

  it('omits a muscle group with no landmark defined for this experience level rather than guessing', () => {
    const statuses = buildMuscleVolumeStatus([session('2026-08-22', 'bench', 4)], MUSCLES, '2026-08-22', 'advanced', landmarks, CREDITING)
    expect(statuses.find(s => s.muscleGroup === 'Chest')).toBeUndefined()
  })
})
