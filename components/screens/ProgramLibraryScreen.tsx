'use client'

import { useState } from 'react'
import { PROGRAM_LIBRARY, type Program } from '@/lib/programs'

interface ProgramLibraryScreenProps {
  onSelect?: (programId: string) => void  // undefined = browse mode; defined = onboarding picker
  selectedId?: string
  onBack?: () => void
}

const STYLE_LABEL: Record<string, string> = {
  hypertrophy: 'HYPERTROPHY',
  strength: 'STRENGTH',
  endurance: 'ENDURANCE',
  powerlifting: 'POWERLIFTING',
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'BEGINNER',
  intermediate: 'INTERMEDIATE',
  advanced: 'ADVANCED',
}

function ProgramCard({
  program,
  isSelected,
  onSelect,
}: {
  program: Program
  isSelected: boolean
  onSelect?: (id: string) => void
}) {
  const { presentation: p } = program
  const [confirming, setConfirming] = useState(false)

  return (
    <div
      className="card"
      style={{
        borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
        transition: 'border-color 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}
    >
      {/* Tags */}
      <div style={{ display: 'flex', gap: '6px', padding: '16px 16px 0' }}>
        <span className="tag" style={{ borderColor: 'var(--rust-border)', color: 'var(--rust)', background: 'var(--rust-dim)' }}>
          {STYLE_LABEL[program.style] ?? program.style.toUpperCase()}
        </span>
        <span className="tag">
          {LEVEL_LABEL[program.level] ?? program.level.toUpperCase()}
        </span>
      </div>

      {/* Name + tagline */}
      <div style={{ padding: '12px 16px 0' }}>
        <div
          className="font-display"
          style={{ fontSize: '2rem', letterSpacing: '0.03em', lineHeight: 1, color: 'var(--text-primary)' }}
        >
          {program.name}
        </div>
        <div
          className="font-body"
          style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '4px', fontWeight: 500 }}
        >
          {p.tagline}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ margin: '14px 16px 0', padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '0' }}>
          {[
            { value: p.daysLabel.split(' / ')[0].split(' ')[0], sub: p.daysLabel.split(' / ')[0].replace(/^\S+\s/, '') + ' / WEEK' },
            { value: p.sessionLength.split(' ')[0] + (p.sessionLength.includes('-') ? '-' + p.sessionLength.split('-')[1].split(' ')[0] : ''), sub: 'MIN / SESSION' },
            { value: p.periodization.split(' ')[0], sub: p.periodization.split(' ').slice(1).join(' ') || 'LOADING' },
          ].map((stat, i) => (
            <div
              key={i}
              className="font-mono"
              style={{
                flex: 1,
                textAlign: 'center',
                borderRight: i < 2 ? '1px solid var(--border)' : 'none',
                padding: '0 8px',
              }}
            >
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', marginTop: '2px' }}>
                {stat.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overview */}
      <div style={{ padding: '14px 16px 0' }}>
        <p
          className="font-body"
          style={{ fontSize: '0.85rem', color: 'var(--text-mid)', lineHeight: 1.55, margin: 0 }}
        >
          {p.overview}
        </p>
      </div>

      {/* What to expect */}
      <div style={{ padding: '14px 16px 0' }}>
        <div className="section-label" style={{ marginBottom: '8px' }}>WHAT TO EXPECT</div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {p.whatToExpect.map((item, i) => (
            <li
              key={i}
              className="font-body"
              style={{ fontSize: '0.85rem', color: 'var(--text-mid)', display: 'flex', gap: '8px', lineHeight: 1.4 }}
            >
              <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }}>·</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Splits */}
      <div style={{ padding: '14px 16px' }}>
        <div className="section-label" style={{ marginBottom: '6px' }}>SPLITS</div>
        <div
          className="font-mono"
          style={{ fontSize: '0.65rem', color: 'var(--text-mid)', letterSpacing: '0.06em' }}
        >
          {program.splits.join('  ·  ')}
        </div>
      </div>

      {/* Select CTA — only shown in picker mode */}
      {onSelect && (
        <div style={{ padding: '0 16px 16px' }}>
          {isSelected ? (
            <div
              className="font-mono"
              style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--accent)', letterSpacing: '0.1em', padding: '10px' }}
            >
              ACTIVE PROGRAM
            </div>
          ) : confirming ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-mid)', lineHeight: 1.5, margin: 0 }}>
                Switch to <span style={{ color: 'var(--accent)' }}>{program.name}</span>? Takes effect next session — your current history is unchanged.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn-primary"
                  style={{ flex: 1, fontSize: '0.8rem' }}
                  onClick={() => { onSelect(program.id); setConfirming(false) }}
                >
                  CONFIRM
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', letterSpacing: '0.08em', padding: '0 16px', cursor: 'pointer' }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn-primary"
              style={{ width: '100%', fontSize: '0.85rem' }}
              onClick={() => setConfirming(true)}
            >
              SELECT PROGRAM
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProgramLibraryScreen({ onSelect, selectedId, onBack }: ProgramLibraryScreenProps) {
  return (
    <div
      className="screen-enter"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)',
      }}
    >
      {/* Header */}
      <div
        className="safe-top"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 16px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-mid)',
              cursor: 'pointer',
              padding: '4px 0',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.08em',
            }}
          >
            ← BACK
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div
            className="font-display"
            style={{ fontSize: '1.5rem', letterSpacing: '0.08em', color: 'var(--text-primary)', lineHeight: 1 }}
          >
            PROGRAMS
          </div>
          <div
            className="font-mono"
            style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginTop: '3px' }}
          >
            TIER 1 — {PROGRAM_LIBRARY.length} PROGRAMS
          </div>
        </div>
      </div>

      {/* Scrollable program list */}
      <div
        className="scroll-area stagger"
        style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        {PROGRAM_LIBRARY.map(program => (
          <ProgramCard
            key={program.id}
            program={program}
            isSelected={selectedId === program.id}
            onSelect={onSelect}
          />
        ))}
        {/* Bottom breathing room for safe-area */}
        <div className="safe-bottom" />
      </div>
    </div>
  )
}
