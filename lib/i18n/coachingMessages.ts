'use client'

/**
 * lib/i18n/coachingMessages.ts — Phase 3.
 *
 * The one piece of plumbing that makes Phase 2's locale-agnostic
 * `{ kind, params }` engine output renderable: a small mapping from each
 * `CoachingFlagKind` to a `messages/{locale}.json` `coaching.flags.*` key,
 * plus the couple of kinds that need one extra decision before rendering
 * (`stall`'s strategyKind→word lookup, `fatigue`'s two distinct trigger
 * shapes). All actual string composition happens here, in the UI layer —
 * never inside lib/coaching/, which stays pure per its own contract.
 *
 * Every flag renders TWO strings — `technical` (the reason-code framing,
 * e.g. "MRV approached for chest, RIR trend declining") and `plain` (the
 * plain-language framing a non-technical lifter reads first, e.g. "You're
 * pushing chest hard right now — let's ease off a little") — per Phase 3's
 * doer scope in the revamp plan (Section 7). Screens choose how much of
 * each to show; this hook always returns both so no screen has to guess.
 */

import { useTranslations } from 'next-intl'
// '@/lib/coaching' (bare) resolves to the OLD lib/coaching.ts, not this
// engine's index.ts — explicit '/index' path required.
import type { CoachingFlag, StallStrategyKind } from '@/lib/coaching/index'

const STRATEGY_KEY: Record<StallStrategyKind, string> = {
  'drop-set': 'dropSet',
  'pause-reps': 'pauseReps',
  'grip-angle': 'gripAngle',
  deload: 'deload',
}

export interface RenderedCoachingFlag {
  technical: string
  plain: string
}

/**
 * Resolves the `coaching.flags.*` message key for a flag, handling the two
 * kinds (`fatigue`) that split into two different param shapes depending on
 * which of engine.ts's two fatigue triggers fired.
 */
function resolveMessageKey(flag: CoachingFlag): string {
  switch (flag.kind) {
    case 'no-history':
      return 'noHistory'
    case 'progress-ready':
      return 'progressReady'
    case 'recovery-hold':
      return 'recoveryHold'
    case 'weight-too-heavy':
      return 'weightTooHeavy'
    case 'fatigue':
      return flag.params.firstSetReps !== undefined ? 'fatigueRepDrop' : 'fatigueRirTrend'
    case 'stall':
      return 'stall'
    case 'deload-recommended':
      return 'deloadRecommended'
    case 'volume-under-mev':
      return 'volumeUnderMev'
    case 'volume-over-mrv':
      return 'volumeOverMrv'
    default:
      return 'noHistory'
  }
}

/**
 * Renders both the technical and plain-language framing for one coaching
 * flag. Call from a component (this is a hook — needs the next-intl
 * context), not from lib/coaching/ or any non-component module.
 */
export function useCoachingFlagText(flag: CoachingFlag): RenderedCoachingFlag {
  const t = useTranslations('coaching.flags')
  const strategyT = useTranslations('coaching.stallStrategy')

  const key = resolveMessageKey(flag)
  const params: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(flag.params)) {
    if (v !== null) params[k] = v as string | number
  }

  // `stall`'s plain framing interpolates {strategy} — resolve the
  // strategyKind → localized word here (UI layer), never inside
  // lib/coaching/, which only ever emits the stable strategyKind enum.
  if (flag.kind === 'stall') {
    const strategyKind = flag.params.strategyKind as StallStrategyKind | undefined
    params.strategy = strategyKind ? strategyT(STRATEGY_KEY[strategyKind]) : ''
  }

  // `volume-under-mev`/`volume-over-mrv` interpolate {muscleGroup} — it's a
  // top-level CoachingFlag field (scope metadata), not part of flag.params,
  // so it's missing from the loop above. Without this, next-intl can't
  // resolve the required ICU argument and silently falls back to rendering
  // the raw message key (e.g. "coaching.flags.volumeUnderMev.plain")
  // instead of the actual text — confirmed live via browser verification.
  // Muscle-group name display stays in English even in es locale for now;
  // localizing it is Phase 4's closed-vocabulary-translation scope, not
  // this fix's job.
  if (flag.muscleGroup) {
    params.muscleGroup = flag.muscleGroup
  }

  return {
    technical: t(`${key}.technical`, params as any),
    plain: t(`${key}.plain`, params as any),
  }
}
