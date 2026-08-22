// GYM-48 / Phase 1: coaching-flag `kind` → visual-treatment mapping.
//
// This is the shared contract Phase 2 (which `kind` values the new
// lib/coaching/ engine actually emits) and Phase 4 (how ProgressHistoryScreen
// renders annotations on top of components/ui/Chart) both consume — the
// plan's own words: "this mapping is the single source of truth."
//
// IMPORTANT — the keys below are the OLD engine's flag `type` union
// (lib/coaching.ts `CoachingFlag['type']`: 'progress' | 'stall' | 'fatigue'
// | 'deload' | 'no-history' | 'recovery-hold' | 'weight-too-heavy'), used
// here only to establish the *shape* of the mapping table and prove every
// existing flag class has a defined treatment. Phase 2 replaces the old
// engine with a structured `{ kind, params }` contract and its own real
// `kind` enum (volume-landmark/RIR/fatigue-deload vocabulary) — when that
// lands, update KIND_VISUALS's keys to match Phase 2's actual `kind`
// values. The Treatment interface / lookup pattern below is the stable
// part; the specific key list is expected to change.

export type FlagSeverity = 'positive' | 'neutral' | 'watch' | 'warning'

export interface FlagVisualTreatment {
  /** Semantic color token from app/globals.css — never a raw hex. */
  colorToken: '--accent' | '--success' | '--text-mid' | '--rust'
  /** Tag/badge background variant, matches the `.tag` CSS classes. */
  badgeVariant: 'accent' | 'rust' | 'neutral'
  severity: FlagSeverity
  /** Simple geometric icon key — resolved to an inline SVG by the
   *  consuming screen (Phase 4); intentionally not an emoji or icon-font
   *  dependency, matching the app's minimal-dependency posture. */
  icon: 'trend-up' | 'trend-flat' | 'trend-down' | 'alert' | 'info'
}

// Old-engine flag type -> treatment. See header comment: keys are a
// placeholder vocabulary until Phase 2 publishes its real `kind` enum.
export const KIND_VISUALS: Record<string, FlagVisualTreatment> = {
  progress: {
    colorToken: '--accent',
    badgeVariant: 'accent',
    severity: 'positive',
    icon: 'trend-up',
  },
  'recovery-hold': {
    colorToken: '--text-mid',
    badgeVariant: 'neutral',
    severity: 'neutral',
    icon: 'trend-flat',
  },
  stall: {
    colorToken: '--rust',
    badgeVariant: 'rust',
    severity: 'watch',
    icon: 'trend-flat',
  },
  fatigue: {
    colorToken: '--rust',
    badgeVariant: 'rust',
    severity: 'watch',
    icon: 'alert',
  },
  'weight-too-heavy': {
    colorToken: '--rust',
    badgeVariant: 'rust',
    severity: 'warning',
    icon: 'trend-down',
  },
  deload: {
    colorToken: '--rust',
    badgeVariant: 'rust',
    severity: 'warning',
    icon: 'alert',
  },
  'no-history': {
    colorToken: '--text-mid',
    badgeVariant: 'neutral',
    severity: 'neutral',
    icon: 'info',
  },
}

/** Falls back to a neutral/info treatment for an unrecognized kind rather
 *  than throwing — annotations must never crash the Reports screen. */
export function getFlagVisualTreatment(kind: string): FlagVisualTreatment {
  return (
    KIND_VISUALS[kind] ?? {
      colorToken: '--text-mid',
      badgeVariant: 'neutral',
      severity: 'neutral',
      icon: 'info',
    }
  )
}

/**
 * Phase 2 RIR-provenance contract (Section 5/Phase 2): every recommendation
 * carries `origin: 'logged-rir' | 'inferred-rep-range'`. Inferred
 * recommendations must render as visually distinct/less certain — Phase 4
 * consumes this alongside getFlagVisualTreatment() (dim the badge / add a
 * "~" prefix / lower opacity, exact styling is a Phase 4 UI decision, but
 * the *hook* to do it is defined here so Phase 4 doesn't have to re-derive
 * where provenance-based styling plugs into the visual system).
 */
export function getProvenanceOpacity(origin: 'logged-rir' | 'inferred-rep-range'): number {
  return origin === 'inferred-rep-range' ? 0.6 : 1
}
