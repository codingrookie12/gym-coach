import { describe, it, expect } from 'vitest'
import { buildResumeStateFromDb, DbResumeExercise, shouldResumeFromLocal, shouldResumeFromDb } from '../sessionResume'
import { SessionExercisePlan } from '../sessionPlan'
import { Exercise } from '../routines'
import { PersistedSession } from '../sessionStorage'

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

  it('keys the snapshot by display name, not canonicalName, for an exercise where they differ', () => {
    // Regression coverage: buildResumeStateFromDb used to key its rebuilt
    // SavedSnapshot map by canonicalName, but every other writer of this same
    // map (ActiveSessionScreen's autosave: `${ex.exerciseName}:${setNumber}`;
    // app/page.tsx's handleSaveSession: `${exLog.exerciseName}:${si + 1}`)
    // keys it by the exercise's display name. For most exercises name ===
    // canonicalName so this went untested — but lib/routines.ts's LEGS_ROUTINE
    // has a real exercise where they diverge: { name: 'Hack Squat',
    // canonicalName: 'Linear Hack Press' }. A DB-fallback resume that keyed
    // wrong here would silently orphan the snapshot entry (no writer would
    // ever look it up under the wrong key), risking a duplicate `sets` row if
    // the user re-visits that already-completed exercise.
    const plan: SessionExercisePlan[] = [
      makePlanItem(makeExercise({ name: 'Hack Squat', canonicalName: 'Linear Hack Press', sets: 3 })),
    ]
    const dbData: DbResumeExercise[] = [
      {
        exerciseName: 'Linear Hack Press',
        sets: [
          { setNumber: 1, weight: 90, reps: 10, notes: '', rir: 2, pageId: 'set-1' },
        ],
      },
    ]

    const { snapshot } = buildResumeStateFromDb(plan, dbData)

    expect(snapshot['Hack Squat:1']).toEqual({ pageId: 'set-1', weight: 90, reps: 10, notes: '', rir: 2 })
    expect(snapshot['Linear Hack Press:1']).toBeUndefined()
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

// ── Resume-prompt trigger logic ─────────────────────────────────────────
//
// "Should ResumePromptScreen show at all" is a separate question from the
// data-reconstruction covered above — this is the decision app/page.tsx's
// detect() makes on mount, now extracted to shouldResumeFromLocal /
// shouldResumeFromDb so it has direct coverage.

function makePersistedSession(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    date: '2026-09-01',
    split: 'Push',
    exIdx: 0,
    logs: [],
    snapshot: {},
    ...overrides,
  }
}

describe('shouldResumeFromLocal', () => {
  it('no prior session in localStorage — does not show', () => {
    expect(shouldResumeFromLocal(null, ['Push', 'Pull', 'Legs'])).toBe(false)
  })

  it('a genuine in-progress session for an active split — shows', () => {
    expect(shouldResumeFromLocal(makePersistedSession({ split: 'Push' }), ['Push', 'Pull'])).toBe(true)
  })

  it('a stored session whose split was since archived/removed from the program — does not show', () => {
    expect(shouldResumeFromLocal(makePersistedSession({ split: 'Push' }), ['Pull', 'Legs'])).toBe(false)
  })

  // A fully-completed prior session is never representable here in the first
  // place: app/page.tsx's handleSaveSession calls clearSessionFromStorage()
  // on every Finish path (confirmed sync, partial sync, and offline-queued
  // alike), so `stored` is structurally null once a session is done —
  // covered by the `null` case above.
})

describe('buildResumeStateFromDb — unit reconstruction (equipment-type/unit-conversion integration)', () => {
  // Regression coverage: a session toggled to kg (ActiveSessionScreen's
  // toggleMassUnit) before localStorage was lost (fresh device, cleared
  // storage) must resume still labeled/treated as kg — the underlying
  // dbSet.weight values are already real kg numbers, so falling back to the
  // routine's static 'lbs' default here would relabel them, exactly the
  // mismatch lib/weightConversion.ts's header warns about (see
  // lib/setUnit.ts's resolveActiveMassUnit, which this feeds).
  it('reconstructs ExerciseLog.unit from the DB rows\' own unit when present', () => {
    const plan: SessionExercisePlan[] = [
      makePlanItem(makeExercise({ name: 'Barbell Squat', canonicalName: 'Barbell Squat', sets: 2, weightUnit: 'lbs' })),
    ]
    const dbData: DbResumeExercise[] = [
      {
        exerciseName: 'Barbell Squat',
        sets: [
          { setNumber: 1, weight: 60, reps: 5, notes: '', rir: 2, pageId: 'set-1', unit: 'Kg' },
          { setNumber: 2, weight: 60, reps: 5, notes: '', rir: 2, pageId: 'set-2', unit: 'Kg' },
        ],
      },
    ]

    const { logs } = buildResumeStateFromDb(plan, dbData)
    expect(logs[0].unit).toBe('Kg')
  })

  it('leaves ExerciseLog.unit undefined when the DB rows carry no unit (a caller that has not selected the column yet) — identical to pre-existing behavior', () => {
    const plan: SessionExercisePlan[] = [
      makePlanItem(makeExercise({ name: 'Barbell Squat', canonicalName: 'Barbell Squat', sets: 1, weightUnit: 'lbs' })),
    ]
    const dbData: DbResumeExercise[] = [
      { exerciseName: 'Barbell Squat', sets: [{ setNumber: 1, weight: 225, reps: 5, notes: '', rir: 2, pageId: 'set-1' }] },
    ]

    const { logs } = buildResumeStateFromDb(plan, dbData)
    expect(logs[0].unit).toBeUndefined()
  })

  it('an exercise the DB has no record of at all gets no unit field either (untouched exercise, identical to before)', () => {
    const plan: SessionExercisePlan[] = [
      makePlanItem(makeExercise({ name: 'Squat', canonicalName: 'Squat', sets: 3 })),
    ]
    const { logs } = buildResumeStateFromDb(plan, [])
    expect(logs[0].unit).toBeUndefined()
  })
})

describe('buildResumeStateFromDb — equipmentInstanceId reconstruction (equipment-type/unit-conversion integration)', () => {
  // Regression coverage, mirrors the unit-reconstruction block above: a set
  // tagged with an equipment instance (ActiveSessionScreen's
  // handleSelectInstance) before localStorage was lost must resume still
  // carrying that tag, both on the rebuilt ExerciseLog (so the instance
  // selector shows the right machine) and in the SavedSnapshot (so a
  // subsequent re-save at Finish-time or mid-session autosave correctly
  // diffs against it instead of treating it as untagged and re-patching).
  it('reconstructs ExerciseLog.equipmentInstanceId from the DB rows\' own value when present', () => {
    const plan: SessionExercisePlan[] = [
      makePlanItem(makeExercise({ name: 'Leg Press', canonicalName: 'Leg Press', sets: 2 })),
    ]
    const dbData: DbResumeExercise[] = [
      {
        exerciseName: 'Leg Press',
        sets: [
          { setNumber: 1, weight: 400, reps: 10, notes: '', rir: 2, pageId: 'set-1', equipmentInstanceId: 'instance-1' },
          { setNumber: 2, weight: 400, reps: 10, notes: '', rir: 2, pageId: 'set-2', equipmentInstanceId: 'instance-1' },
        ],
      },
    ]

    const { logs, snapshot } = buildResumeStateFromDb(plan, dbData)
    expect(logs[0].equipmentInstanceId).toBe('instance-1')
    expect(snapshot['Leg Press:1']).toMatchObject({ equipmentInstanceId: 'instance-1' })
    expect(snapshot['Leg Press:2']).toMatchObject({ equipmentInstanceId: 'instance-1' })
  })

  it('leaves ExerciseLog.equipmentInstanceId undefined when the DB rows carry none (a caller that has not selected the column yet, or the migration is unapplied) — identical to pre-existing behavior', () => {
    const plan: SessionExercisePlan[] = [
      makePlanItem(makeExercise({ name: 'Leg Press', canonicalName: 'Leg Press', sets: 1 })),
    ]
    const dbData: DbResumeExercise[] = [
      { exerciseName: 'Leg Press', sets: [{ setNumber: 1, weight: 400, reps: 10, notes: '', rir: 2, pageId: 'set-1' }] },
    ]

    const { logs, snapshot } = buildResumeStateFromDb(plan, dbData)
    expect(logs[0].equipmentInstanceId).toBeUndefined()
    // The snapshot entry must have the exact same shape it had before this
    // field existed — no `equipmentInstanceId: null` key spuriously added.
    expect(snapshot['Leg Press:1']).toEqual({ pageId: 'set-1', weight: 400, reps: 10, notes: '', rir: 2 })
  })

  it('an exercise the DB has no record of at all gets no equipmentInstanceId field either (untouched exercise, identical to before)', () => {
    const plan: SessionExercisePlan[] = [
      makePlanItem(makeExercise({ name: 'Squat', canonicalName: 'Squat', sets: 3 })),
    ]
    const { logs } = buildResumeStateFromDb(plan, [])
    expect(logs[0].equipmentInstanceId).toBeUndefined()
  })

  it('null equipmentInstanceId on every set (explicitly untagged) is treated the same as unset — no field on the rebuilt ExerciseLog', () => {
    const plan: SessionExercisePlan[] = [
      makePlanItem(makeExercise({ name: 'Leg Press', canonicalName: 'Leg Press', sets: 1 })),
    ]
    const dbData: DbResumeExercise[] = [
      { exerciseName: 'Leg Press', sets: [{ setNumber: 1, weight: 400, reps: 10, notes: '', rir: 2, pageId: 'set-1', equipmentInstanceId: null }] },
    ]

    const { logs, snapshot } = buildResumeStateFromDb(plan, dbData)
    expect(logs[0].equipmentInstanceId).toBeUndefined()
    expect(snapshot['Leg Press:1']).toEqual({ pageId: 'set-1', weight: 400, reps: 10, notes: '', rir: 2 })
  })
})

describe('shouldResumeFromDb', () => {
  it('no DB response — does not show', () => {
    expect(shouldResumeFromDb(null, ['Push', 'Pull'])).toBe(false)
  })

  it('DB-fallback detection (GYM-98): localStorage empty, DB has an unfinished workout — shows', () => {
    expect(shouldResumeFromDb({ found: true, split: 'Pull' }, ['Push', 'Pull'])).toBe(true)
  })

  it('DB says nothing found for today — does not show', () => {
    expect(shouldResumeFromDb({ found: false }, ['Push', 'Pull'])).toBe(false)
  })

  it('found split is no longer an active split in the program — does not show', () => {
    expect(shouldResumeFromDb({ found: true, split: 'Legs' }, ['Push', 'Pull'])).toBe(false)
  })

  // A fully-completed prior session cannot reach `found: true` either:
  // GET /api/session/today filters its `workouts` query on
  // `.is('finished_at', null)`, so a completed workout is excluded before
  // this predicate ever sees it — verified directly against that query
  // shape in app/api/session/today/route.test.ts.
})
