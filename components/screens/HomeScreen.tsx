'use client'

import { Split } from '@/lib/routines'

interface HomeScreenProps {
  onSelectSplit: (split: Split) => void
  onSettings: () => void
}

export default function HomeScreen({ onSelectSplit, onSettings }: HomeScreenProps) {
  const splits: { label: Split; sub: string }[] = [
    { label: 'Push', sub: 'CHEST · SHOULDERS · TRICEPS' },
    { label: 'Pull', sub: 'BACK · BICEPS · FOREARMS' },
    { label: 'Legs', sub: 'QUADS · HAMS · GLUTES · CALVES' },
  ]

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div
        className="safe-top flex items-center justify-between px-5"
        style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}
      >
        <span className="font-mono-display text-xs tracking-widest" style={{ color: 'var(--text-secondary)' }}>
          GYM COACH
        </span>
        <button
          onClick={onSettings}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '6px 10px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            fontFamily: 'DM Mono, monospace',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          WEIGHTS
        </button>
      </div>

      {/* Split selectors — full height */}
      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {splits.map((s, i) => (
          <button
            key={s.label}
            className="split-btn"
            onClick={() => onSelectSplit(s.label)}
            style={{
              background: 'none',
              border: 'none',
              borderRight: i < splits.length - 1 ? '1px solid var(--border)' : 'none',
              padding: '0',
              outline: 'none',
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <span
                className="font-mono-display"
                style={{ fontSize: '2.25rem', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
              >
                {s.label}
              </span>
              <span
                style={{
                  fontSize: '0.6rem',
                  letterSpacing: '0.15em',
                  color: 'var(--text-secondary)',
                  fontFamily: 'DM Mono, monospace',
                  textAlign: 'center',
                  lineHeight: 1.6,
                  padding: '0 8px',
                }}
              >
                {s.sub.split(' · ').join('\n').split('\n').map((line, li) => (
                  <span key={li} style={{ display: 'block' }}>{line}</span>
                ))}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Bottom indicator */}
      <div
        className="safe-bottom flex items-center justify-center"
        style={{ paddingTop: '12px', borderTop: '1px solid var(--border)' }}
      >
        <span className="font-mono-display text-xs" style={{ color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
          SELECT SPLIT TO BEGIN
        </span>
      </div>
    </div>
  )
}
