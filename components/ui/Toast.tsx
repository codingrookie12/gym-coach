'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

interface ToastProps {
  message: string
  onUndo: () => void
  onTimeout: () => void
  duration?: number
}

/**
 * components/ui/Toast — GYM-94/GYM-95/Phase 1: formalized from its previous
 * standalone location (components/UndoToast.tsx) into the components/ui/
 * primitive library. This is the ONLY UI surface backing the non-negotiable
 * routine-write provenance rule (CLAUDE.md "Routine writes") — every
 * INSERT into `user_routine_exercises` must show this toast with a working
 * Undo before the write commits. Do not fork/duplicate this component;
 * extend it here if a new call site needs a variant.
 *
 * Self-managed timer; parent owns the state that determines whether the
 * toast is rendered. Undo button text is localized (`toast.undo`); the
 * `message` itself is passed in by the caller (screen-specific content —
 * e.g. "Bench Press added", not part of this primitive's own vocabulary).
 */
export default function Toast({ message, onUndo, onTimeout, duration = 3000 }: ToastProps) {
  const t = useTranslations('toast')

  useEffect(() => {
    const timer = setTimeout(onTimeout, duration)
    return () => clearTimeout(timer)
  }, [onTimeout, duration])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        boxShadow: 'var(--shadow-elevated)',
        zIndex: 60,
        animation: 'slideUp 0.2s ease',
        whiteSpace: 'nowrap',
      }}
    >
      <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
        {message}
      </span>
      <button
        onClick={onUndo}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontFamily: 'Space Mono, monospace',
          fontSize: '0.65rem',
          letterSpacing: '0.08em',
          cursor: 'pointer',
          // 44x44 tap-target floor: minHeight alone isn't enough — "UNDO"
          // (4 chars, 0.65rem Space Mono) renders narrower than 44px with
          // padding: '8px 0' (no horizontal padding), so minWidth + real
          // horizontal padding are both needed. Note this is an English-
          // string risk, not the usual Spanish-overflow direction this
          // primitive library otherwise guards against — Spanish
          // "DESHACER" (8 chars) already clears 44px on its own.
          padding: '8px 12px',
          minHeight: '44px',
          minWidth: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
        }}
      >
        {t('undo')}
      </button>
    </div>
  )
}
