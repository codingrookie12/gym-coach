'use client'

import { useCallback, useState } from 'react'
import { Split, SPLIT_ORDER } from '@/lib/routines'

interface PreSessionScreenProps {
  initialSplit: Split
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

export default function PreSessionScreen({
  initialSplit,
  onSelectSplit,
  onSettings,
  onEquipment,
  unavailableCount,
  pendingCustomCount = 0,
}: PreSessionScreenProps) {
  const [selectedIdx, setSelectedIdx] = useState(() => SPLIT_ORDER.indexOf(initialSplit))

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setSelectedIdx(i => Math.max(0, i - 1))
    else if (e.key === 'ArrowRight') setSelectedIdx(i => Math.min(SPLIT_DATA.length - 1, i + 1))
    else if (e.key === 'Enter' || e.key === ' ') onSelectSplit(SPLIT_ORDER[selectedIdx])
  }, [selectedIdx, onSelectSplit])

  const selectedSplit = SPLIT_ORDER[selectedIdx]

  return (
    <div
      className="screen-enter flex flex-col"
      style={{ height: '100%', background: 'var(--bg)' }}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {/* Header */}
      <div
        className="safe-top flex items-center justify-between px-5"
        style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span className="font-display" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
            GYM COACH
          </span>
          <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            v6.0
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

      {/* Split columns */}
      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {SPLIT_DATA.map((s, i) => {
          const isSelected = i === selectedIdx
          return (
            <button
              key={s.label}
              onClick={() => setSelectedIdx(i)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: isSelected ? 'var(--surface)' : 'none',
                border: 'none',
                borderTop: `3px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                borderRight: i < SPLIT_DATA.length - 1 ? '1px solid var(--border)' : 'none',
                padding: 0,
                cursor: isSelected ? 'default' : 'pointer',
                position: 'relative',
                transition: 'background 0.18s',
              }}
            >
              {/* Inner content — dimmed when not selected */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px',
                  opacity: isSelected ? 1 : 0.35,
                  transition: 'opacity 0.18s',
                }}
              >
                {/* Index */}
                <span
                  className="font-mono"
                  style={{
                    position: 'absolute',
                    top: '16px',
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontSize: '0.55rem',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.1em',
                  }}
                >
                  {s.index}
                </span>

                {/* Split name */}
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

                {/* Accent bar */}
                <div style={{ width: '24px', height: '2px', background: 'var(--accent)', opacity: 0.5 }} />

                {/* Muscles */}
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
          )
        })}
      </div>

      {/* Footer */}
      <div
        className="safe-bottom"
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <button
          className="btn-primary"
          onClick={() => onSelectSplit(selectedSplit)}
        >
          START {selectedSplit.toUpperCase()}
        </button>
      </div>
    </div>
  )
}
