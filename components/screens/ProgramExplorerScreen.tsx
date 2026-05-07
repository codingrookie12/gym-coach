'use client'

import { useState } from 'react'
import { PROGRAM_TEMPLATES, type ProgramTemplate } from '@/lib/programTemplates'
import { t } from '@/lib/translations'

interface ProgramExplorerScreenProps {
  ownedTemplateIds: Set<string>
  onBack: () => void
  onAdd: (programId: string) => void
  userId?: string
}

export default function ProgramExplorerScreen({
  ownedTemplateIds, onBack, onAdd, userId,
}: ProgramExplorerScreenProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState(false)

  async function handleAdd(templateId: string) {
    setAdding(templateId)
    setError(false)
    try {
      const res = await fetch('/api/user/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'clone', templateId }),
      })
      const data = await res.json()
      if (!res.ok || !data.programId) throw new Error(data.error ?? 'Clone failed')
      await fetch('/api/user/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userProgramId: data.programId }),
      })
      onAdd(data.programId)
    } catch (err) {
      console.error('handleAdd failed:', err)
      setError(true)
      setAdding(null)
    }
  }

  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="safe-top"
        style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', padding: '4px 0', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.08em' }}
        >
          {t.explorer.backButton}
        </button>
        <div style={{ flex: 1 }}>
          <div className="font-display" style={{ fontSize: '1.5rem', letterSpacing: '0.08em', color: 'var(--text-primary)', lineHeight: 1 }}>
            {t.explorer.title}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="scroll-area" style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {error && (
          <div className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--rust)', letterSpacing: '0.06em', padding: '10px 14px', background: 'var(--rust-dim)', border: '1px solid var(--rust-border)', borderRadius: '2px' }}>
            {t.explorer.errorGeneric}
          </div>
        )}

        {PROGRAM_TEMPLATES.map(template => (
          <ExplorerCard
            key={template.id}
            template={template}
            expanded={expandedId === template.id}
            onToggle={() => setExpandedId(prev => prev === template.id ? null : template.id)}
            owned={ownedTemplateIds.has(template.id)}
            onAdd={() => handleAdd(template.id)}
            adding={adding === template.id}
          />
        ))}

        <div className="safe-bottom" />
      </div>
    </div>
  )
}

function ExplorerCard({ template, expanded, onToggle, owned, onAdd, adding }: {
  template: ProgramTemplate
  expanded: boolean
  onToggle: () => void
  owned: boolean
  onAdd: () => void
  adding: boolean
}) {
  const p = template.presentation

  return (
    <div className="card" style={{ padding: '16px', cursor: 'pointer' }} onClick={onToggle}>
      {/* Tags row */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <span className="tag rust">
          {template.style.toUpperCase()}
        </span>
        <span className="tag">
          {template.level.toUpperCase()}
        </span>
      </div>

      {/* Name */}
      <div className="font-display" style={{ fontSize: '1.6rem', letterSpacing: '0.03em', lineHeight: 1, color: 'var(--text-primary)' }}>
        {template.name}
      </div>

      {/* Tagline */}
      <p className="font-body" style={{ fontSize: '0.85rem', color: 'var(--text-mid)', marginTop: '6px', lineHeight: 1.5, marginBottom: '6px' }}>
        {p.tagline}
      </p>

      {/* Meta line */}
      <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: '4px' }}>
        {p.daysLabel} · {p.sessionLength} · {p.periodization}
      </div>

      {/* Attribution */}
      {p.attribution && (
        <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-mid)', letterSpacing: '0.06em', marginBottom: '4px' }}>
          by {p.attribution}
        </div>
      )}

      {/* Expand chevron */}
      <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'right', marginTop: '4px' }}>
        {expanded ? '▾' : '›'}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          {/* Overview */}
          <p className="font-body" style={{ fontSize: '0.8rem', color: 'var(--text-mid)', lineHeight: 1.6, margin: '0 0 14px 0' }}>
            {p.overview}
          </p>

          {/* What to expect */}
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px 0' }}>
            {p.whatToExpect.map((item, i) => (
              <li key={i} className="font-body" style={{ fontSize: '0.75rem', color: 'var(--text-mid)', lineHeight: 1.6, paddingLeft: '12px', position: 'relative', marginBottom: '4px' }}>
                <span style={{ position: 'absolute', left: 0, color: 'var(--accent)' }}>·</span>
                {item}
              </li>
            ))}
          </ul>

          {/* Splits & exercises */}
          <div className="section-label" style={{ marginBottom: '8px' }}>{t.explorer.splitsHeader}</div>
          {template.splits.map(split => (
            <div key={split.name} style={{ marginBottom: '12px' }}>
              <div className="font-sans" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {split.name}
              </div>
              {split.exercises.map((ex, i) => (
                <div key={i} className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-mid)', letterSpacing: '0.04em', lineHeight: 1.8 }}>
                  {ex.name} — {ex.sets}x [{ex.repRange[0]}–{ex.repRange[1]}]
                </div>
              ))}
            </div>
          ))}

          {/* CTA */}
          {owned ? (
            <button
              disabled
              className="font-mono"
              style={{
                width: '100%', padding: '12px', marginTop: '8px',
                background: 'none', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: '0.7rem',
                letterSpacing: '0.08em', borderRadius: '2px', cursor: 'default',
              }}
            >
              {t.explorer.ownedButton}
            </button>
          ) : (
            <button
              onClick={onAdd}
              disabled={adding}
              className="btn-primary"
              style={{ width: '100%', fontSize: '0.8rem', marginTop: '8px' }}
            >
              {adding ? t.explorer.addingButton : t.explorer.addButton}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
