import { describe, it, expect } from 'vitest'
import { buildResumeStateFromDb, DbResumeExercise } from '../sessionResume'
import { SessionExercisePlan } from '../sessionPlan'
import { Exercise } from '../routines'

// Regression coverage for the bug: handleResume() in app/page.tsx checked
// only `detectedSession` (localStorage) and no-op'd when it was null, even
// though `detectedSplit` (the DB-fallback signal — fires on a fresh device
// or after localStorage is cleared) was set. ResumePromptScreen would
// render "Continue Today?" but tapping it did nothing, leaving "Start
// Fresh" (which deletes the day's workout) as the only apparent option.
//
// This tests the pure merge function the fix now calls once the plan
// resolves: it must reconstruct real logged sets from the DB-fallback
// payload, not synthesize a blank session or discard already-completed data.

function makeExercise(overrides: Partial<Exercise> & { name: string; canonicalName: string; sets: number }): Exercise {
  return {
    repRange: [8, 12],
    backup: null,
    split: 'Push',
    weightUnit: 'lbs',
    ...overrides,
  }
}

function makePlanItem(exercise: Exercise, targetWeight: number | null = 135): SessionExercisePlan {
  return {
    exercise,
    exerciseId: `id-${exercise.canonicalName}`,
    targetWeight,
    targetWeightOrigin: null,
    flags: [],
  }
}

describe('buildResumeStateFromDb', () => {
  it('marks a fully-logged exercise complete with real weight/reps and advances exIdx past it', () => {
    const plan: SessionExercisePlan[] = [
      makePlanItem(makeExercise({ name: 'Barbell Bench Press', canonicalName: 'Barbell Bench Press', sets: 3 })),
      makePlanItem(makeExercise({ name: 'Incline DB Press', canonicalName: 'Incline DB Press', sets: 3 })),
    ]
    const dbData: DbResumeExercise[] = [
      {
        exerciseName: 'Barbell Bench Press',
        sets: [
          { setNumber: 1, weight: 185, reps: 8, notes: '', rir: 2, pageId: 'set-1' },
          { setNumber: 2, weight: 185, reps: 7, notes: '', rir: 1, pageId: 'set-2' },
          { setNumber: 3, weight: 185, reps: 6, notes: '', rir: 0, pageId: 'set-3' },
        ],
      },
    ]

    const { logs, exIdx, snapshot } = buildResumeStateFromDb(plan, dbData)

    // The completed exercise must carry the REAL logged data, not a blank
    // re-derivation from the plan's target weight.
    expect(logs[0].sets).toEqual([
      { weight: 185, reps: 8, completed: true, skipped: false, rir: 2 },
      { weight: 185, reps: 7, completed: true, skipped: false, rir: 1 },
      { weight: 185, reps: 6, completed: true, skipped: false, rir: 0 },
    ])
    // Not-yet-touched exercise stays a fresh, uncompleted plan-derived shell.
    expect(logs[1].sets.every(s => !s.completed)).toBe(true)
    // Resume lands on the first exercise with no DB data — never a no-op,
    // never re-doing already-completed work.
    expect(exIdx).toBe(1)

    // Snapshot must carry pageIds so subsequent edits/finish still target
    // the real Supabase rows (not re-insert duplicates).
    expect(snapshot['Barbell Bench Press:1']).toEqual({ pageId: 'set-1', weight: 185, reps: 8, notes: '', rir: 2 })
    expect(snapshot['Barbell Bench Press:3']).toEqual({ pageId: 'set-3', weight: 185, reps: 6, notes: '', rir: 0 })
  })

  it('never fabricates completed sets for an exercise the DB has no record of', () => {
    const plan: SessionExercisePlan[] = [
      makePlanItem(makeExercise({ name: 'Squat', canonicalName: 'Squat', sets: 3 })),
    ]
    const { logs, exIdx, snapshot } = buildResumeStateFromDb(plan, [])

    expect(logs[0].sets.every(s => !s.completed)).toBe(true)
    expect(exIdx).toBe(0)
    expect(snapshot).toEqual({})
  })

  it('lands on the last exercise (not past the end) when every plan exercise already has DB data', () => {
    const plan: SessionExercisePlan[] = [
      makePlanItem(makeExercise({ name: 'Squat', canonicalName: 'Squat', sets: 1 })),
      makePlanItem(makeExercise({ name: 'Leg Press', canonicalName: 'Leg Press', sets: 1 })),
    ]
    const dbData: DbResumeExercise[] = [
      { exerciseName: 'Squat', sets: [{ setNumber: 1, weight: 225, reps: 5, notes: '', rir: 2, pageId: 'p1' }] },
      { exerciseName: 'Leg Press', sets: [{ setNumber: 1, weight: 400, reps: 10, notes: '', rir: 3, pageId: 'p2' }] },
    ]

    const { exIdx } = buildResumeStateFromDb(plan, dbData)
    expect(exIdx).toBe(1)
  })

  it('matches DB exercises to plan items by canonicalName, not array position', () => {
    const plan: SessionExercisePlan[] = [
      makePlanItem(makeExercise({ name: 'Incline DB Press', canonicalName: 'Incline DB Press', sets: 2 })),
      makePlanItem(makeExercise({ name: 'Barbell Bench Press', canonicalName: 'Barbell Bench Press', sets: 2 })),
    ]
    // DB data arrives in a different order than the (freshly recomputed) plan.
    const dbData: DbResumeExercise[] = [
      { exerciseName: 'Barbell Bench Press', sets: [{ setNumber: 1, weight: 185, reps: 8, notes: '', rir: 2, pageId: 'p1' }] },
    ]

    const { logs, exIdx } = buildResumeStateFromDb(plan, dbData)
    expect(logs[0].canonicalName).toBe('Incline DB Press')
    expect(logs[0].sets.every(s => !s.completed)).toBe(true)
    expect(logs[1].canonicalName).toBe('Barbell Bench Press')
    expect(logs[1].sets[0]).toEqual({ weight: 185, reps: 8, completed: true, skipped: false, rir: 2 })
    // First plan item with no DB data is index 0, not 1.
    expect(exIdx).toBe(0)
  })
})
