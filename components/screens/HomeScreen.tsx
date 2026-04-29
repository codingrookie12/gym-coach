'use client'

import { Split } from '@/lib/routines'

interface HomeScreenProps {
  onSelectSplit: (split: Split) => void
  onSettings: () => void
  onEquipment: () => void
  unavailableCount: number
  pendingCustomCount?: number
}

const SPLIT_DATA: { label: Split; muscles: string[]; index: string }[] = [
  { label: 'Push', muscles: ['Chest', 'Shoulders', 'Triceps'], index: '01' },
  { label: 'Pull', muscles: ['Back', 'Biceps', 'Forearms'], index: '02' },
  { label: 'Legs', muscles: ['Quads', 'Hams', 'Glutes', 'Calves'], index: '03' },
]

export default function HomeScreen({ onSelectSplit, onSettings, onEquipment, unavailableCount, pendingCustomCount = 0 }: HomeScreenProps) {
  return (
    <div className="screen-enter flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>

      {/* Header */}
      <div
        className="safe-top flex items-center justify-between px-5"
        style={{
          paddingBottom: '14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span className="font-display" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
            GYM COACH
          </span>
          <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            v5.0
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={onEquipment}
            style={{
              background: 'none',
              border: `1px solid ${unavailableCount > 0 ? 'var(--rust)' : 'var(--border-2)'}`,
              borderRadius: '2px',
              padding: '7px 12px',
              color: unavailableCount > 0 ? 'var(--rust)' : 'var(--text-mid)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: '0.95rem',
              letterSpacing: '0.1em',
              transition: 'border-color 0.12s, color 0.12s',
              position: 'relative',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="7" width="3" height="10" rx="1" />
              <rect x="19" y="7" width="3" height="10" rx="1" />
              <rect x="6" y="10" width="12" height="4" rx="1" />
            </svg>
            EQUIP{unavailableCount > 0 && <span style={{ marginLeft: '2px' }}>({unavailableCount})</span>}
          </button>
          <button
            onClick={onSettings}
            style={{
              background: 'none',
              border: '1px solid var(--border-2)',
              borderRadius: '2px',
              padding: '7px 12px',
              color: 'var(--text-mid)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: '0.95rem',
              letterSpacing: '0.1em',
              transition: 'border-color 0.12s, color 0.12s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            WEIGHTS
          </button>
        </div>
      </div>

      {/* Split selectors */}
      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {SPLIT_DATA.map((s, i) => (
          <button
            key={s.label}
            className="split-btn"
            onClick={() => onSelectSplit(s.label)}
            style={{
              borderRight: i < SPLIT_DATA.length - 1 ? '1px solid var(--border)' : 'none',
              padding: '0',
            }}
          >
            {/* Index number — top left */}
            <span
              className="font-mono"
              style={{
                position: 'absolute',
                top: '16px',
                left: '0',
                right: '0',
                textAlign: 'center',
                fontSize: '0.55rem',
                color: 'var(--border-2)',
                letterSpacing: '0.1em',
              }}
            >
              {s.index}
            </span>

            {/* Main content */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              {/* Big label */}
              <span
                className="font-display"
                style={{
                  fontSize: 'clamp(2.8rem, 7vw, 4rem)',
                  color: 'var(--text-primary)',
                  lineHeight: 1,
                  letterSpacing: '0.04em',
                }}
              >
                {s.label}
              </span>

              {/* Accent line */}
              <div style={{ width: '24px', height: '2px', background: 'var(--accent)', opacity: 0.5 }} />

              {/* Muscle list */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                {s.muscles.map((m) => (
                  <span
                    key={m}
                    className="font-mono"
                    style={{
                      fontSize: '0.55rem',
                      color: 'var(--text-secondary)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div
        className="safe-bottom flex items-center px-5"
        style={{ paddingTop: '12px', borderTop: '1px solid var(--border)' }}
      >
        <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>
          SELECT SPLIT TO BEGIN
        </span>
      </div>
    </div>
  )
}
