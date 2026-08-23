/**
 * lib/coaching/flags.ts
 *
 * CoachingFlag construction — the one place that assembles the
 * locale-agnostic `{ kind, params }` contract (Phase 2 doer scope item 3).
 * No string concatenation, no English text, anywhere in this file or
 * anything it calls.
 */

import {
  CoachingFlag,
  CoachingFlagKind,
  CoachingFlagParams,
  CoachingFlagScope,
  RirProvenance,
  StallStrategyKind,
} from './types'

/** Replaces lib/coaching.ts:139's hardcoded English `strategies` array,
 *  selected by index off `noProgressCount % strategies.length`. Same
 *  rotation mechanic (deliberately kept — Tier 1, no reason to change a
 *  fine index-rotation scheme), but the array now holds locale-agnostic
 *  kinds instead of finished English sentences. Phase 1's locale-keyed
 *  template dictionary maps each kind to real per-locale copy. */
const STALL_STRATEGY_ROTATION: StallStrategyKind[] = ['drop-set', 'pause-reps', 'grip-angle', 'deload']

export function pickStallStrategy(stalledSessionCount: number): StallStrategyKind {
  return STALL_STRATEGY_ROTATION[stalledSessionCount % STALL_STRATEGY_ROTATION.length]
}

export interface BuildFlagInput {
  kind: CoachingFlagKind
  scope: CoachingFlagScope
  exerciseId?: string | null
  muscleGroup?: string | null
  date?: string | null
  params: CoachingFlagParams
  origin: RirProvenance | 'structural'
  landmarksVersion: number
  setCreditingVersion: number
}

export function buildFlag(input: BuildFlagInput): CoachingFlag {
  const idParts = [input.scope, input.exerciseId ?? input.muscleGroup ?? 'session', input.kind, input.date ?? 'nodate']
  return {
    id: idParts.join(':'),
    kind: input.kind,
    scope: input.scope,
    exerciseId: input.exerciseId ?? null,
    muscleGroup: input.muscleGroup ?? null,
    date: input.date ?? null,
    params: input.params,
    origin: input.origin,
    landmarksVersion: input.landmarksVersion,
    setCreditingVersion: input.setCreditingVersion,
  }
}
