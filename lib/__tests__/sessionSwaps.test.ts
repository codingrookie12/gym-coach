/**
 * mergeSessionSwap (lib/sessionSwaps.ts) — regression coverage for the
 * session-lifecycle audit finding: a mid-session swap chain (A→B, then from
 * that same slot B→C) used to append two independent sessionSwaps entries
 * instead of collapsing to one. See the module's own docstring for the full
 * mechanism and why the stale intermediate entry was dangerous
 * (PreSaveSummaryScreen's "make default?" would let it be confirmed,
 * permanently swapping the routine to an exercise with none of the
 * session's logged data behind it).
 */
import { describe, it, expect } from 'vitest'
import { mergeSessionSwap } from '../sessionSwaps'

describe('mergeSessionSwap', () => {
  it('a single swap is recorded as-is', () => {
    expect(mergeSessionSwap([], 'Bench Press', 'Incline Press')).toEqual([
      { oldName: 'Bench Press', newName: 'Incline Press' },
    ])
  })

  it('two unrelated swaps (different slots) both stay as independent entries', () => {
    const afterFirst = mergeSessionSwap([], 'Bench Press', 'Incline Press')
    const afterSecond = mergeSessionSwap(afterFirst, 'Squat', 'Leg Press')
    expect(afterSecond).toEqual([
      { oldName: 'Bench Press', newName: 'Incline Press' },
      { oldName: 'Squat', newName: 'Leg Press' },
    ])
  })

  it('BUG FIX: a chained swap (A→B, then B→C) collapses to one entry against the ORIGINAL exercise (A→C)', () => {
    const afterFirst = mergeSessionSwap([], 'Bench Press', 'Incline Press')
    const afterSecond = mergeSessionSwap(afterFirst, 'Incline Press', 'Cable Fly')

    expect(afterSecond).toEqual([
      { oldName: 'Bench Press', newName: 'Cable Fly' },
    ])
  })

  it('a longer chain (A→B→C→D) still collapses to a single A→D entry', () => {
    let swaps = mergeSessionSwap([], 'A', 'B')
    swaps = mergeSessionSwap(swaps, 'B', 'C')
    swaps = mergeSessionSwap(swaps, 'C', 'D')
    expect(swaps).toEqual([{ oldName: 'A', newName: 'D' }])
  })

  it('a round-trip swap (A→B, then back B→A) collapses to nothing — no net change to offer "make default?" for', () => {
    const afterFirst = mergeSessionSwap([], 'Bench Press', 'Incline Press')
    const afterRoundTrip = mergeSessionSwap(afterFirst, 'Incline Press', 'Bench Press')
    expect(afterRoundTrip).toEqual([])
  })

  it('a chain interleaved with an unrelated swap only collapses the actual chain', () => {
    let swaps = mergeSessionSwap([], 'Bench Press', 'Incline Press')
    swaps = mergeSessionSwap(swaps, 'Squat', 'Leg Press')
    swaps = mergeSessionSwap(swaps, 'Incline Press', 'Cable Fly')

    expect(swaps).toEqual([
      { oldName: 'Bench Press', newName: 'Cable Fly' },
      { oldName: 'Squat', newName: 'Leg Press' },
    ])
  })

  it('never mutates the input array', () => {
    const original = [{ oldName: 'A', newName: 'B' }]
    const result = mergeSessionSwap(original, 'B', 'C')
    expect(original).toEqual([{ oldName: 'A', newName: 'B' }])
    expect(result).not.toBe(original)
  })
})
