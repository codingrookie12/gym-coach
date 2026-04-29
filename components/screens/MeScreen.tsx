'use client'

import type { User } from '@supabase/supabase-js'

interface MeScreenProps {
  user: User | null
  onLogout: () => void
}

export default function MeScreen({ user, onLogout }: MeScreenProps) {
  return (
    <div
      className="flex flex-col"
      style={{ height: '100%', background: 'var(--bg)' }}
    >
      {/* Header */}
      <div
        className="safe-top"
        style={{
          padding: '0 20px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span className="font-display" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
          ME
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Account */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>
            ACCOUNT
          </span>
          <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
            {user?.email ?? '—'}
          </span>
        </div>

      </div>

      {/* Footer */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onLogout}
          className="font-mono"
          style={{
            fontSize: '0.55rem',
            color: 'var(--text-secondary)',
            letterSpacing: '0.1em',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textTransform: 'uppercase',
            padding: 0,
          }}
        >
          SIGN OUT
        </button>
      </div>
    </div>
  )
}
