import { describe, it, expect } from 'vitest'
import { aggregateExercises, aggregateGroups, aggregateWeeklyVolume, resolveExerciseMeta } from '../progressAggregation'
import type { HistoryProgress, ExerciseMuscleMeta } from '../supabase.queries'

// GYM-92 regression coverage (Phase 4 scope item 1): a set logged against a
// custom exercise (not in the static ALL_EXERCISES catalog) must still
// resolve a muscle group and count toward muscle-balance aggregation,
// instead of silently vanishing.

describe('resolveExerciseMeta', () => {
  it('resolves a catalog exercise by name when no DB meta is available', () => {
    const { group } = resolveExerciseMeta({ exerciseId: null, name: 'Barbell Bench Press - Medium Grip' }, new Map())
    expect(group).toBe('Chest')
  })

  it('resolves a custom exercise by exercise_id via DB-sourced meta (the GYM-92 fix)', () => {
    const metaByExerciseId = new Map<string, ExerciseMuscleMeta>([
      ['custom-uuid-1', { primaryMuscles: ['Biceps'], secondaryMuscles: [], split: 'Pull' }],
    ])
    const { group, split } = resolveExerciseMeta(
      { exerciseId: 'custom-uuid-1', name: 'Cable Concentration Curl (My Variant)' },
      metaByExerciseId
    )
    expect(group).toBe('Arms')
    expect(split).toBe('Pull')
  })

  it('falls back to null (not a crash) when neither DB meta nor a catalog match exists', () => {
    const { group } = resolveExerciseMeta({ exerciseId: 'unknown-uuid', name: 'Totally Made Up Exercise' }, new Map())
    expect(group).toBeNull()
  })
})

describe('aggregateExercises + aggregateGroups — custom exercise no longer vanishes', () => {
  it('counts a custom exercise into its muscle group instead of dropping it', () => {
    // Must fall within aggregateGroups' rolling "this week" (last 7 days)
    // window relative to whenever the test actually runs.
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const recentDate = new Date(today.getTime() - 2 * 86400000).toISOString().slice(0, 10)

    const progress: HistoryProgress = {
      exercises: [
        {
          exerciseId: 'custom-uuid-1',
          name: 'Cable Concentration Curl (My Variant)',
          sets: [
            { date: recentDate, weight: 30, reps: 10, unit: 'Lbs' },
            { date: recentDate, weight: 30, reps: 10, unit: 'Lbs' },
          ],
        },
      ],
      days: [{ date: recentDate, count: 1 }],
    }
    const metaByExerciseId = new Map<string, ExerciseMuscleMeta>([
      ['custom-uuid-1', { primaryMuscles: ['Biceps'], secondaryMuscles: [], split: 'Pull' }],
    ])

    // Before the fix: metaByExerciseId defaults to empty, and the custom
    // exercise's name isn't in the static catalog — group comes back null,
    // and it doesn't contribute to any MUSCLE_GROUPS bucket.
    const withoutMeta = aggregateExercises(progress)
    expect(withoutMeta[0].group).toBeNull()
    const groupsWithoutMeta = aggregateGroups(withoutMeta)
    const armsWithoutMeta = groupsWithoutMeta.find(g => g.group === 'Arms')!
    expect(armsWithoutMeta.setsThisWeek).toBe(0)

    // After the fix: DB-sourced meta resolves the group correctly, and the
    // sets show up in the Arms muscle-balance bucket.
    const withMeta = aggregateExercises(progress, metaByExerciseId)
    expect(withMeta).toHaveLength(1)
    expect(withMeta[0].group).toBe('Arms')
    expect(withMeta[0].split).toBe('Pull')

    const groups = aggregateGroups(withMeta)
    const arms = groups.find(g => g.group === 'Arms')!
    expect(arms.setsThisWeek).toBe(2)
  })
})

describe('aggregateWeeklyVolume', () => {
  it('sums weight × reps into the correct week bucket', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString().slice(0, 10)

    const progress: HistoryProgress = {
      exercises: [
        {
          exerciseId: 'x1',
          name: 'Barbell Squat',
          sets: [
            { date: todayIso, weight: 100, reps: 5, unit: 'Lbs' },
            { date: todayIso, weight: 100, reps: 5, unit: 'Lbs' },
          ],
        },
      ],
      days: [{ date: todayIso, count: 1 }],
    }

    const weeks = aggregateWeeklyVolume(progress, 4)
    expect(weeks).toHaveLength(4)
    // Current week (last bucket) should carry all the volume: 100*5*2 = 1000
    expect(weeks[weeks.length - 1].volume).toBe(1000)
    expect(weeks.slice(0, 3).every(w => w.volume === 0)).toBe(true)
  })

  it('returns zeroed weeks for empty history without throwing', () => {
    const weeks = aggregateWeeklyVolume({ exercises: [], days: [] }, 6)
    expect(weeks).toHaveLength(6)
    expect(weeks.every(w => w.volume === 0)).toBe(true)
  })
})
