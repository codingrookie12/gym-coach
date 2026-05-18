'use client'

import { useCallback, useState } from 'react'
import { Program, ACTIVE_PROGRAM } from '@/lib/programs'

interface PreSessionScreenProps {
  initialSplit: string
  onSelectSplit: (split: string) => void
  onSettings: () => void
  pendingCustomCount?: number
  activeProgram?: Program
}

export default function PreSessionScreen({
  initialSplit,
  onSelectSplit,
  onSettings,
  pendingCustomCount = 0,
  activeProgram = ACTIVE_PROGRAM,
}: PreSessionScreenProps) {
  const splits = activeProgram.splits
  const splitMuscles = activeProgram.splitMuscles

  const [selectedIdx, setSelectedIdx] = useState(() => {
    const idx = splits.indexOf(initialSplit)
    return idx >= 0 ? idx : 0
  })

  // Font size scales down as column count grows (longer split names in 4-col layouts)
  const splitFontSize = splits.length <= 2
    ? 'clamp(3rem, 10vw, 5rem)'
    : splits.length === 3
      ? 'clamp(2.8rem, 7vw, 4rem)'
      : 'clamp(1.4rem, 3.5vw, 2.2rem)'

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setSelectedIdx(i => Math.max(0, i - 1))
    else if (e.key === 'ArrowRight') setSelectedIdx(i => Math.min(splits.length - 1, i + 1))
    else if (e.key === 'Enter' || e.key === ' ') onSelectSplit(splits[selectedIdx])
  }, [splits, selectedIdx, onSelectSplit])

  const selectedSplit = splits[selectedIdx]

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
            v7.18
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
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
        {splits.map((splitName, i) => {
          const isSelected = i === selectedIdx
          const muscles = splitMuscles[splitName] ?? []
          return (
            <button
              key={splitName}
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
                borderRight: i < splits.length - 1 ? '1px solid var(--border)' : 'none',
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
                  padding: '0 4px',
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
                  {String(i + 1).padStart(2, '0')}
                </span>

                {/* Split name */}
                <span
                  className="font-display"
                  style={{
                    fontSize: splitFontSize,
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                    letterSpacing: '0.04em',
                    textAlign: 'center',
                    wordBreak: 'break-word',
                  }}
                >
                  {splitName}
                </span>

                {/* Accent bar */}
                <div style={{ width: '24px', height: '2px', background: 'var(--accent)', opacity: 0.5 }} />

                {/* Muscles */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  {muscles.slice(0, 4).map(m => (
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
