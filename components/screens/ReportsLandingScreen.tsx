'use client'

import { useTranslations } from 'next-intl'

/**
 * Phase 1 stub — GYM-19/Section 6: landing screen for the new standalone
 * Reports tab (Train / Library / Reports / Me). This is intentionally NOT
 * a rebuild of ProgressHistoryScreen — that rebuild, plus moving
 * ProgressHistoryScreen to live here as the tab's real landing screen and
 * render Phase 2's coaching annotations, is explicitly Phase 4's job (see
 * the revamp plan's Phase 4 doer scope). This stub only proves the tab +
 * routing shell exist and are reachable in exactly 1 tap from home — the
 * concrete, testable form of "reports front-and-center" ratified in
 * Section 6. History remains reachable today via Library → History
 * (ExerciseLibraryScreen's onOpenHistory) until Phase 4 consolidates it
 * here.
 */
export default function ReportsLandingScreen() {
  const t = useTranslations('reports')

  return (
    <div className="flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>
      <div
        className="safe-top flex items-center px-5"
        style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <span className="font-display" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
          {t('title')}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '32px' }}>
        <span className="font-display" style={{ fontSize: '1.4rem', color: 'var(--text-primary)', textAlign: 'center', letterSpacing: '0.04em' }}>
          {t('comingSoonHeading')}
        </span>
        <span className="font-sans" style={{ fontSize: '0.95rem', color: 'var(--text-mid)', textAlign: 'center', maxWidth: '320px' }}>
          {t('comingSoonBody')}
        </span>
      </div>
    </div>
  )
}
