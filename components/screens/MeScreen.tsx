'use client'

import type { User } from '@supabase/supabase-js'

interface MeScreenProps {
  user: User | null
  onLogout: () => void
}

export default function MeScreen({ user, onLogout }: MeScreenProps) {
  const meta = user?.user_metadata ?? {}
  const fullName: string | null = meta.full_name ?? meta.name ?? null

  return (
    <div className="flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>

      {/* Header */}
      <div
        className="safe-top flex items-center px-5"
        style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <span className="font-display" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
          ME
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Account section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', letterSpacing: '0.12em', marginBottom: '12px' }}>
            ACCOUNT
          </span>

          {fullName && (
            <div style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
              <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                {fullName}
              </span>
            </div>
          )}

          <div style={{ paddingTop: fullName ? '10px' : '0', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
            <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-mid)', letterSpacing: '0.05em' }}>
              {user?.email ?? '—'}
            </span>
          </div>

          <div style={{ paddingTop: '10px' }}>
            <button
              onClick={onLogout}
              className="font-mono"
              style={{
                fontSize: '0.75rem',
                color: 'var(--rust)',
                letterSpacing: '0.08em',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textTransform: 'uppercase',
                padding: 0,
                textAlign: 'left',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
