import { describe, it, expect } from 'vitest'
import {
  computeExerciseFatigueSignal,
  computeSessionRpeFatigueSignal,
  computeDeloadRecommendation,
} from '../fatigue'
import { CoachingSession, RirReading } from '../types'

function readings(...values: number[]): RirReading[] {
  return values.map(value => ({ value, origin: 'logged-rir' as const }))
}

describe('computeExerciseFatigueSignal', () => {
  it('flags fatigue when recent average RIR is at or below the threshold', () => {
    const signal = computeExerciseFatigueSignal('ex-1', [readings(0, 1), readings(1, 0), readings(1, 1)])
    expect(signal.fatigued).toBe(true)
  })

  it('does not flag fatigue for a healthy RIR trend', () => {
    const signal = computeExerciseFatigueSignal('ex-1', [readings(3, 4), readings(3, 3)])
    expect(signal.fatigued).toBe(false)
  })

  it('only looks at the most recent sessions window, not the whole history', () => {
    // recent sessions are healthy; only an old session (beyond the window) was fatigued
    const signal = computeExerciseFatigueSignal('ex-1', [readings(4, 4), readings(3, 4), readings(4, 3), readings(0, 0)])
    expect(signal.fatigued).toBe(false)
  })

  it('returns null recentAvgRir (not fatigued) when there is no data', () => {
    const signal = computeExerciseFatigueSignal('ex-1', [])
    expect(signal.recentAvgRir).toBeNull()
    expect(signal.fatigued).toBe(false)
  })
})

describe('computeSessionRpeFatigueSignal', () => {
  function sessionWithRpe(date: string, rpe: number | null): CoachingSession {
    return { workoutId: date, date, sessionRpe: rpe, exercises: {} }
  }

  it('flags fatigue when recent session RPE is consistently high (Foster scale, higher = harder)', () => {
    const signal = computeSessionRpeFatigueSignal([sessionWithRpe('d3', 9), sessionWithRpe('d2', 8), sessionWithRpe('d1', 8)])
    expect(signal.fatigued).toBe(true)
  })

  it('does not flag fatigue for moderate session RPE', () => {
    const signal = computeSessionRpeFatigueSignal([sessionWithRpe('d2', 5), sessionWithRpe('d1', 6)])
    expect(signal.fatigued).toBe(false)
  })

  it('handles no session-RPE data gracefully (nullable column, many sessions will have none)', () => {
    const signal = computeSessionRpeFatigueSignal([sessionWithRpe('d1', null)])
    expect(signal.recentAvgSessionRpe).toBeNull()
    expect(signal.fatigued).toBe(false)
  })
})

describe('computeDeloadRecommendation', () => {
  it('recommends a deload when multiple exercises show a sustained RIR fatigue signal', () => {
    const result = computeDeloadRecommendation(
      [
        { exerciseId: 'a', recentAvgRir: 0.5, fatigued: true },
        { exerciseId: 'b', recentAvgRir: 0.5, fatigued: true },
        { exerciseId: 'c', recentAvgRir: 3, fatigued: false },
      ],
      { fatigued: false }
    )
    expect(result).toBe(true)
  })

  it('does not recommend a deload for a single fatigued exercise alone (requires corroboration)', () => {
    const result = computeDeloadRecommendation(
      [
        { exerciseId: 'a', recentAvgRir: 0.5, fatigued: true },
        { exerciseId: 'b', recentAvgRir: 3, fatigued: false },
      ],
      { fatigued: false }
    )
    expect(result).toBe(false)
  })

  it('recommends a deload from session-RPE fatigue alone, independent of per-exercise RIR signals', () => {
    const result = computeDeloadRecommendation([{ exerciseId: 'a', recentAvgRir: 3, fatigued: false }], { fatigued: true })
    expect(result).toBe(true)
  })
})
