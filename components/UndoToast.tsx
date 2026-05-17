'use client'

import { useEffect } from 'react'

interface UndoToastProps {
  message: string
  onUndo: () => void
  onTimeout: () => void
  duration?: number
}

/**
 * GYM-95: 3s Undo toast for in-memory session-plan mutations (adds + removes).
 * Self-managed timer; parent owns the state that determines whether the toast
 * is rendered. Styling matches RoutineEditorScreen's GYM-94 toast.
 */
export default function UndoToast({ message, onUndo, onTimeout, duration = 3000 }: UndoToastProps) {
  useEffect(() => {
    const t = setTimeout(onTimeout, duration)
    return () => clearTimeout(t)
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
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
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
          padding: '0',
          fontWeight: 700,
        }}
      >
        UNDO
      </button>
    </div>
  )
}
