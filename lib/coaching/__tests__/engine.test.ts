import { describe, it, expect } from 'vitest'
import { analyzeCoaching } from '../engine'
import { DEFAULT_LANDMARKS, DEFAULT_SET_CREDITING_RULE } from '../landmarks'
import { AnalyzeCoachingInput, CoachingSession, RoutineExerciseWithMuscles } from '../types'

const TODAY = '2026-08-22'

function bench(overrides: Partial<RoutineExerciseWithMuscles> = {}): RoutineExerciseWithMuscles {
  return {
    exerciseId: 'ex-bench',
    exerciseName: 'Barbell Bench Press',
    repRange: [6, 8],
    availableWeights: [135, 140, 145, 150],
    primaryMuscles: ['Chest'],
    secondaryMuscles: ['Triceps', 'Shoulders'],
    ...overrides,
  }
}

function session(date: string, sets: { weight: number; reps: number; rir: number | null }[], sessionRpe: number | null = null): CoachingSession {
  return {
    workoutId: `w-${date}`,
    date,
    sessionRpe,
    exercises: { 'ex-bench': { sets: sets.map((s, i) => ({ setNumber: i + 1, ...s })) } },
  }
}

function baseInput(overrides: Partial<AnalyzeCoachingInput> = {}): AnalyzeCoachingInput {
  return {
    today: TODAY,
    experienceLevel: 'intermediate',
    routine: [bench()],
    sessions: [],
    programSessions: [],
    exerciseMuscles: { 'ex-bench': { primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps', 'Shoulders'] } },
    weightOverrides: {},
    landmarks: DEFAULT_LANDMARKS,
    setCreditingRule: DEFAULT_SET_CREDITING_RULE,
    ...overrides,
  }
}

describe('analyzeCoaching — no history', () => {
  it('flags no-history and returns a null target weight when there is no override', () => {
    const { plan } = analyzeCoaching(baseInput())
    expect(plan[0].targetWeight).toBeNull()
    expect(plan[0].flags.some(f => f.kind === 'no-history')).toBe(true)
  })

  it('carries forward a weight override with structural origin, no no-history flag', () => {
    const { plan } = analyzeCoaching(baseInput({ weightOverrides: { 'ex-bench': 135 } }))
    expect(plan[0].targetWeight).toBe(135)
    expect(plan[0].targetWeightOrigin).toBe('structural')
    expect(plan[0].flags.some(f => f.kind === 'no-history')).toBe(false)
  })
})

describe('analyzeCoaching — progression', () => {
  // NOTE: RIR values in this block are deliberately >= 3 (comfortable, not
  // grinding). Hitting the top of the prescribed rep range does NOT by
  // itself mean "near failure" — the whole point of RIR-based autoregulation
  // is distinguishing "hit the target comfortably" (should progress) from
  // "hit the target while grinding" (fatigue signal, see the fatigue
  // describe block below, which deliberately uses low RIR).

  it('recommends a weight increase after 2 consecutive sessions hitting the top of the rep range', () => {
    const sessions = [
      session('2026-08-19', [{ weight: 135, reps: 8, rir: 3 }, { weight: 135, reps: 8, rir: 3 }]),
      session('2026-08-16', [{ weight: 135, reps: 8, rir: 3 }, { weight: 135, reps: 8, rir: 3 }]),
    ]
    const { plan } = analyzeCoaching(baseInput({ sessions }))
    expect(plan[0].targetWeight).toBe(140) // snapped to next availableWeight
    const flag = plan[0].flags.find(f => f.kind === 'progress-ready')!
    expect(flag).toBeDefined()
    expect(flag.params).toEqual({ fromWeight: 135, toWeight: 140, topOfRange: 8 })
    expect(flag.origin).toBe('logged-rir') // every reading behind this was logged
  })

  it('holds weight instead of progressing when the recovery gap is too short', () => {
    const sessions = [
      session('2026-08-21', [{ weight: 135, reps: 8, rir: 3 }, { weight: 135, reps: 8, rir: 3 }]),
      session('2026-08-19', [{ weight: 135, reps: 8, rir: 3 }, { weight: 135, reps: 8, rir: 3 }]),
    ]
    const { plan } = analyzeCoaching(baseInput({ sessions }))
    expect(plan[0].flags.some(f => f.kind === 'recovery-hold')).toBe(true)
    expect(plan[0].flags.some(f => f.kind === 'progress-ready')).toBe(false)
  })

  it('tags progression origin inferred-rep-range when any qualifying session had no logged RIR', () => {
    const sessions = [
      session('2026-08-19', [{ weight: 135, reps: 8, rir: null }, { weight: 135, reps: 8, rir: 3 }]),
      session('2026-08-16', [{ weight: 135, reps: 8, rir: 3 }, { weight: 135, reps: 8, rir: 3 }]),
    ]
    const { plan } = analyzeCoaching(baseInput({ sessions }))
    const flag = plan[0].flags.find(f => f.kind === 'progress-ready')!
    expect(flag.origin).toBe('inferred-rep-range')
  })
})

describe('analyzeCoaching — weight too heavy', () => {
  it('flags and reduces weight after 2 consecutive sessions below the bottom of the rep range', () => {
    const sessions = [
      session('2026-08-20', [{ weight: 145, reps: 4, rir: 0 }]),
      session('2026-08-17', [{ weight: 145, reps: 5, rir: 0 }]),
    ]
    const { plan } = analyzeCoaching(baseInput({ sessions }))
    expect(plan[0].flags.some(f => f.kind === 'weight-too-heavy')).toBe(true)
    expect(plan[0].targetWeight).toBe(140) // snapped down to previous availableWeight
  })
})

describe('analyzeCoaching — stall + strategy rotation', () => {
  it('flags a stall after 3+ sessions at the same weight with no progression, carrying a strategyKind (never English text)', () => {
    const sessions = [
      session('2026-08-20', [{ weight: 135, reps: 6, rir: 2 }]),
      session('2026-08-17', [{ weight: 135, reps: 6, rir: 2 }]),
      session('2026-08-14', [{ weight: 135, reps: 6, rir: 2 }]),
    ]
    const { plan } = analyzeCoaching(baseInput({ sessions }))
    const flag = plan[0].flags.find(f => f.kind === 'stall')!
    expect(flag).toBeDefined()
    expect(['drop-set', 'pause-reps', 'grip-angle', 'deload']).toContain(flag.params.strategyKind)
  })
})

describe('analyzeCoaching — fatigue', () => {
  it('flags within-session fatigue when reps drop sharply across sets', () => {
    const sessions = [session('2026-08-20', [{ weight: 135, reps: 8, rir: 2 }, { weight: 135, reps: 7, rir: 1 }, { weight: 135, reps: 5, rir: 0 }])]
    const { plan } = analyzeCoaching(baseInput({ sessions }))
    expect(plan[0].flags.some(f => f.kind === 'fatigue')).toBe(true)
  })

  it('flags cross-session RIR-trend fatigue even without a within-session rep drop', () => {
    const sessions = [
      session('2026-08-20', [{ weight: 135, reps: 6, rir: 0 }]),
      session('2026-08-17', [{ weight: 135, reps: 6, rir: 1 }]),
      session('2026-08-14', [{ weight: 135, reps: 6, rir: 0 }]),
    ]
    const { plan } = analyzeCoaching(baseInput({ sessions }))
    expect(plan[0].flags.some(f => f.kind === 'fatigue')).toBe(true)
  })
})

describe('analyzeCoaching — fatigue-triggered deload (replaces the old noProgressCount>=4 trigger)', () => {
  it('recommends a session-level deload when session RPE is consistently high, independent of any single exercise stalling', () => {
    const sessions = [
      session('2026-08-20', [{ weight: 135, reps: 7, rir: 2 }], 9),
      session('2026-08-17', [{ weight: 135, reps: 7, rir: 2 }], 9),
    ]
    const { context } = analyzeCoaching(baseInput({ sessions }))
    expect(context.deloadRecommended).toBe(true)
    expect(context.flags.some(f => f.kind === 'deload-recommended')).toBe(true)
  })

  it('does NOT trigger deload purely from a long stall with healthy RIR (the old engine would have, at noProgressCount>=4)', () => {
    const sessions = [
      session('2026-08-20', [{ weight: 135, reps: 6, rir: 4 }]),
      session('2026-08-17', [{ weight: 135, reps: 6, rir: 4 }]),
      session('2026-08-14', [{ weight: 135, reps: 6, rir: 4 }]),
      session('2026-08-11', [{ weight: 135, reps: 6, rir: 4 }]),
    ]
    const { context } = analyzeCoaching(baseInput({ sessions }))
    expect(context.deloadRecommended).toBe(false)
  })
})

describe('analyzeCoaching — data maturity', () => {
  it('is limited-history for a brand-new account', () => {
    const { context } = analyzeCoaching(baseInput({ programSessions: [] }))
    expect(context.dataMaturity).toBe('limited-history')
  })

  it('is established once program-wide history accrues', () => {
    const programSessions = Array.from({ length: 15 }, (_, i) => session(`2026-0${1 + Math.floor(i / 9)}-${String((i % 28) + 1).padStart(2, '0')}`, [{ weight: 100, reps: 8, rir: 2 }]))
    const { context } = analyzeCoaching(baseInput({ programSessions }))
    expect(context.dataMaturity).toBe('established')
  })
})

describe('analyzeCoaching — volume landmarks', () => {
  it('flags a muscle group under MEV when weekly credited sets fall short', () => {
    const { context } = analyzeCoaching(baseInput({ programSessions: [] }))
    expect(context.muscleVolume.some(m => m.muscleGroup === 'Chest' && m.zone === 'under-mev')).toBe(true)
    expect(context.flags.some(f => f.kind === 'volume-under-mev' && f.muscleGroup === 'Chest')).toBe(true)
  })

  it('flags a muscle group over MRV when weekly credited sets exceed it', () => {
    // Chest MRV (intermediate) is 22 credited sets — 5 sessions x 6 sets x
    // 1.0 primary credit = 30, comfortably over, all within the 7-day window.
    const sixSets = [{ weight: 100, reps: 8, rir: 3 }, { weight: 100, reps: 8, rir: 3 }, { weight: 100, reps: 8, rir: 3 }, { weight: 100, reps: 8, rir: 3 }, { weight: 100, reps: 8, rir: 3 }, { weight: 100, reps: 8, rir: 3 }]
    const heavyWeek = ['2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22'].map(date => session(date, sixSets))
    const { context } = analyzeCoaching(baseInput({ programSessions: heavyWeek }))
    expect(context.muscleVolume.some(m => m.muscleGroup === 'Chest' && m.zone === 'over-mrv')).toBe(true)
  })

  it('stamps landmarksVersion/setCreditingVersion on every muscle-volume status and matching flags', () => {
    const { context } = analyzeCoaching(baseInput())
    for (const status of context.muscleVolume) {
      expect(status.landmarksVersion).toBe(1)
      expect(status.setCreditingVersion).toBe(1)
    }
  })

  it('defaults to the novice landmark tier when experienceLevel is null (cold-start default)', () => {
    const { context } = analyzeCoaching(baseInput({ experienceLevel: null }))
    const chest = context.muscleVolume.find(m => m.muscleGroup === 'Chest')!
    const noviceLandmark = DEFAULT_LANDMARKS.find(l => l.muscleGroup === 'Chest' && l.experienceLevel === 'novice')!
    expect(chest.mev).toBe(noviceLandmark.mev)
  })
})

describe('analyzeCoaching — exercise_id-based matching (GYM-92 regression)', () => {
  it('aggregates a custom exercise correctly even when its display name differs from the routine plan entry by case (the real Standing Low-Pulley scenario)', () => {
    const customBench = bench({
      exerciseId: 'ex-custom-1',
      exerciseName: 'my custom bench thing', // deliberately different casing/text from anything in the session
    })
    const sessions: CoachingSession[] = [
      {
        workoutId: 'w1',
        date: '2026-08-19',
        sessionRpe: null,
        // keyed by exercise_id, NOT by name — this is the fix. The old
        // engine would have compared this session's exercise *name* against
        // `customBench.exerciseName` and silently dropped it on any
        // mismatch; this engine never compares names at all here.
        exercises: { 'ex-custom-1': { sets: [{ setNumber: 1, weight: 100, reps: 8, rir: 3 }, { setNumber: 2, weight: 100, reps: 8, rir: 3 }] } },
      },
      {
        workoutId: 'w2',
        date: '2026-08-16',
        sessionRpe: null,
        exercises: { 'ex-custom-1': { sets: [{ setNumber: 1, weight: 100, reps: 8, rir: 3 }, { setNumber: 2, weight: 100, reps: 8, rir: 3 }] } },
      },
    ]
    const { plan } = analyzeCoaching(
      baseInput({
        routine: [customBench],
        sessions,
        exerciseMuscles: { 'ex-custom-1': { primaryMuscles: ['Chest'], secondaryMuscles: [] } },
      })
    )
    // The custom exercise's history was found and aggregated (2 qualifying
    // sessions => progression triggered) — it did NOT silently vanish.
    expect(plan[0].flags.some(f => f.kind === 'progress-ready')).toBe(true)
  })
})

describe('analyzeCoaching — no locale-specific string ever leaks into engine output', () => {
  it('every flag across every scenario is a {kind, params} pair with no message/English-prose field', () => {
    const scenarios: AnalyzeCoachingInput[] = [
      baseInput(),
      baseInput({ weightOverrides: { 'ex-bench': 135 } }),
      baseInput({
        sessions: [
          session('2026-08-20', [{ weight: 135, reps: 8, rir: 1 }, { weight: 135, reps: 8, rir: 1 }]),
          session('2026-08-17', [{ weight: 135, reps: 8, rir: 1 }, { weight: 135, reps: 8, rir: 1 }]),
        ],
      }),
      baseInput({
        sessions: [
          session('2026-08-20', [{ weight: 145, reps: 4, rir: 0 }]),
          session('2026-08-17', [{ weight: 145, reps: 5, rir: 0 }]),
        ],
      }),
      baseInput({
        sessions: [
          session('2026-08-20', [{ weight: 135, reps: 6, rir: 2 }], 9),
          session('2026-08-17', [{ weight: 135, reps: 6, rir: 2 }], 9),
        ],
      }),
    ]

    for (const scenario of scenarios) {
      const { context, plan } = analyzeCoaching(scenario)
      const allFlags = [...context.flags, ...plan.flatMap(p => p.flags)]
      for (const flag of allFlags) {
        expect(flag).not.toHaveProperty('message')
        // kind is always a short hyphenated token, never a sentence
        expect(flag.kind).not.toMatch(/\s/)
        for (const [key, value] of Object.entries(flag.params)) {
          if (typeof value === 'string') {
            // a real locale-agnostic param value is a short id/kind token,
            // never rendered English prose with multiple words + punctuation
            expect(value, `flag ${flag.kind} param "${key}"`).not.toMatch(/[.!?]/)
          }
        }
      }
    }
  })
})
