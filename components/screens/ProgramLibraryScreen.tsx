'use client'

import { useEffect, useState } from 'react'
import { PROGRAM_TEMPLATES, type ProgramTemplate } from '@/lib/programTemplates'
import CustomProgramBuilderScreen from './CustomProgramBuilderScreen'

interface UserProgramSummary {
  id: string
  name: string
  sourceTemplateId: string | null
  splitCount: number
  exerciseCount: number
}

interface ProgramLibraryScreenProps {
  onSelect?: (programId: string) => void
  selectedId?: string
  onBack?: () => void
  userId?: string
  activeSession?: boolean
}

export default function ProgramLibraryScreen({
  onSelect, selectedId, onBack, userId, activeSession,
}: ProgramLibraryScreenProps) {
  const [userPrograms, setUserPrograms] = useState<UserProgramSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [builderMode, setBuilderMode] = useState<'create' | 'edit' | null>(null)
  const [editProgramId, setEditProgramId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadPrograms() }, [])

  async function loadPrograms() {
    try {
      const res = await fetch('/api/user/programs')
      const data = await res.json()
      setUserPrograms(data.programs ?? [])
    } catch {}
    setLoading(false)
  }

  async function handleSelectProgram(userProgramId: string) {
    await fetch('/api/user/program', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userProgramId }),
    })
    onSelect?.(userProgramId)
  }

  async function handleCloneTemplate(templateId: string) {
    try {
      const res = await fetch('/api/user/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'clone', templateId }),
      })
      const data = await res.json()
      if (data.programId) {
        await fetch('/api/user/program', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userProgramId: data.programId }),
        })
        onSelect?.(data.programId)
      }
    } catch {}
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/user/programs/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setUserPrograms(prev => prev.filter(p => p.id !== id))
        if (selectedId === id) {
          onSelect?.('')
        }
      }
    } catch {}
    setDeleting(false)
    setConfirmDeleteId(null)
  }

  if (builderMode && userId) {
    return (
      <CustomProgramBuilderScreen
        mode={builderMode}
        programId={editProgramId ?? undefined}
        userId={userId}
        activeSession={activeSession}
        onCancel={() => { setBuilderMode(null); setEditProgramId(null) }}
        onSaved={async (programId) => {
          setBuilderMode(null)
          setEditProgramId(null)
          await loadPrograms()
          await handleSelectProgram(programId)
        }}
      />
    )
  }

  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="safe-top"
        style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', padding: '4px 0', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.08em' }}
          >
            ← BACK
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div className="font-display" style={{ fontSize: '1.5rem', letterSpacing: '0.08em', color: 'var(--text-primary)', lineHeight: 1 }}>
            PROGRAMS
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="scroll-area" style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* MY PROGRAMS section */}
        <section>
          <div className="section-label" style={{ marginBottom: '10px' }}>MY PROGRAMS</div>
          {loading ? (
            <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>LOADING...</p>
          ) : userPrograms.length === 0 ? (
            <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              No custom programs yet — clone a template below or build your own.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {userPrograms.map(program => (
                <div key={program.id} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <p className="font-sans" style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>
                        {program.name}
                      </p>
                      <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: 0 }}>
                        {program.splitCount} splits · {program.exerciseCount} exercises
                      </p>
                    </div>
                    {selectedId === program.id && (
                      <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', letterSpacing: '0.08em' }}>ACTIVE</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    {userId && (
                      <button
                        onClick={() => { setEditProgramId(program.id); setBuilderMode('edit') }}
                        className="font-mono"
                        style={{ fontSize: '0.6rem', padding: '6px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-mid)', cursor: 'pointer', letterSpacing: '0.08em' }}
                      >
                        EDIT
                      </button>
                    )}
                    {confirmDeleteId === program.id ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => handleDelete(program.id)}
                          disabled={deleting}
                          className="font-mono"
                          style={{ fontSize: '0.6rem', padding: '6px 12px', background: 'var(--rust)', border: 'none', borderRadius: '2px', color: '#fff', cursor: 'pointer', letterSpacing: '0.08em' }}
                        >
                          {deleting ? '...' : 'CONFIRM'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="font-mono"
                          style={{ fontSize: '0.6rem', padding: '6px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-mid)', cursor: 'pointer', letterSpacing: '0.08em' }}
                        >
                          CANCEL
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(program.id)}
                        className="font-mono"
                        style={{ fontSize: '0.6rem', padding: '6px 12px', background: 'none', border: '1px solid var(--rust-border)', borderRadius: '2px', color: 'var(--rust)', cursor: 'pointer', letterSpacing: '0.08em' }}
                      >
                        DELETE
                      </button>
                    )}
                    {selectedId !== program.id && onSelect && (
                      <button
                        onClick={() => handleSelectProgram(program.id)}
                        className="font-mono"
                        style={{ fontSize: '0.6rem', padding: '6px 12px', background: 'var(--accent)', border: 'none', borderRadius: '2px', color: '#fff', cursor: 'pointer', letterSpacing: '0.08em', marginLeft: 'auto' }}
                      >
                        SELECT
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Build my own CTA */}
          {userId && (
            <button
              onClick={() => setBuilderMode('create')}
              className="font-mono"
              style={{
                display: 'block', width: '100%', marginTop: '12px', padding: '14px',
                background: 'none', border: '2px dashed var(--accent)',
                color: 'var(--accent)', fontSize: '0.7rem', cursor: 'pointer',
                letterSpacing: '0.1em', borderRadius: '2px', fontWeight: 600,
              }}
            >
              + BUILD MY OWN
            </button>
          )}
        </section>

        {/* TEMPLATES section */}
        <section>
          <div className="section-label" style={{ marginBottom: '10px' }}>TEMPLATES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {PROGRAM_TEMPLATES.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onClone={() => handleCloneTemplate(template.id)}
              />
            ))}
          </div>
        </section>

        <div className="safe-bottom" />
      </div>
    </div>
  )
}

function TemplateCard({ template, onClone }: { template: ProgramTemplate; onClone: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const p = template.presentation

  return (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <span className="tag" style={{ borderColor: 'var(--rust-border)', color: 'var(--rust)', background: 'var(--rust-dim)' }}>
          {(p as any).style?.toUpperCase() ?? 'HYPERTROPHY'}
        </span>
      </div>
      <div className="font-display" style={{ fontSize: '1.6rem', letterSpacing: '0.03em', lineHeight: 1, color: 'var(--text-primary)' }}>
        {template.name}
      </div>
      <p className="font-body" style={{ fontSize: '0.85rem', color: 'var(--text-mid)', marginTop: '6px', lineHeight: 1.5, marginBottom: '6px' }}>
        {p.tagline}
      </p>
      <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: '12px' }}>
        {p.daysLabel} · {p.sessionLength}
      </div>
      <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: '12px' }}>
        {template.splits.map(s => s.name).join('  ·  ')}
      </div>
      {confirming ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-primary" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => { onClone(); setConfirming(false) }}>
            CONFIRM
          </button>
          <button
            onClick={() => setConfirming(false)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', letterSpacing: '0.08em', padding: '0 16px', cursor: 'pointer' }}
          >
            CANCEL
          </button>
        </div>
      ) : (
        <button className="btn-primary" style={{ width: '100%', fontSize: '0.8rem' }} onClick={() => setConfirming(true)}>
          USE THIS TEMPLATE
        </button>
      )}
    </div>
  )
}
