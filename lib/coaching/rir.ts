/**
 * lib/coaching/rir.ts
 *
 * RIR (Reps in Reserve) resolution + provenance. Consumes Phase 1's
 * `sets.rir` contract verbatim (integer 0-5+, NULL = not logged) — never
 * redefines that domain. When a set has no logged RIR (the ~500 historical
 * sets predating this column, or any set the lifter chooses to skip the tap
 * on), the engine infers an approximate value from where the rep count
 * landed inside the exercise's prescribed rep range and tags it
 * `inferred-rep-range` — a deliberately weak, near-binary signal per the
 * plan's Sports-science framing, never blended silently into real logged-RIR
 * confidence.
 */

import { RirReading, RirValue, RirProvenance } from './types'

const MIN_RIR = 0
const MAX_RIR = 5

function clampRir(value: number): RirValue {
  return Math.min(MAX_RIR, Math.max(MIN_RIR, Math.round(value)))
}

/**
 * Rep-range-position inference — the documented v1 simplification.
 * At/above the top of the prescribed range → assume the set was taken close
 * to failure (RIR 1). At/below the bottom of the range → assume more was
 * left in the tank (RIR 3). Linearly interpolated in between, rounded to the
 * nearest integer. Deliberately narrow (1-3 band) — this is NOT a claim that
 * rep count alone determines effort (it doesn't; the same rep count can be
 * near-max or easy depending on the weight chosen), it's the documented,
 * honest floor of what's inferable without a logged RIR at all.
 */
export function inferRirFromRepRange(reps: number, repRange: [number, number]): RirValue {
  const [min, max] = repRange
  if (max <= min) return clampRir(2)
  if (reps >= max) return clampRir(1)
  if (reps <= min) return clampRir(3)
  const t = (reps - min) / (max - min)
  return clampRir(3 - 2 * t)
}

/**
 * Resolves the effective RIR reading for one logged set: the real logged
 * value if present, otherwise the rep-range inference — always tagged with
 * its true origin.
 */
export function resolveRir(
  loggedRir: RirValue | null,
  reps: number,
  repRange: [number, number]
): RirReading {
  if (loggedRir !== null && loggedRir !== undefined) {
    return { value: clampRir(loggedRir), origin: 'logged-rir' }
  }
  return { value: inferRirFromRepRange(reps, repRange), origin: 'inferred-rep-range' }
}

/**
 * Combines the provenance of multiple RIR readings that fed one
 * recommendation. Per Phase 2 doer scope item 5: never blend inferred
 * readings silently into logged-RIR confidence — if ANY reading behind a
 * recommendation was inferred, the whole recommendation is tagged
 * `inferred-rep-range`, the weaker of the two. Only when every reading is a
 * real logged value does the recommendation earn `logged-rir`.
 */
export function combineProvenance(readings: RirReading[]): RirProvenance {
  return readings.some(r => r.origin === 'inferred-rep-range') ? 'inferred-rep-range' : 'logged-rir'
}

export function averageRir(readings: RirReading[]): number | null {
  if (readings.length === 0) return null
  return readings.reduce((sum, r) => sum + r.value, 0) / readings.length
}
