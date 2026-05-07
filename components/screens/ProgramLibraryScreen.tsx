'use client'

import { useEffect, useState } from 'react'
import CustomProgramBuilderScreen from './CustomProgramBuilderScreen'
import ProgramExplorerScreen from './ProgramExplorerScreen'
import { t } from '@/lib/translations'

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
  initialMode?: 'explorer' | 'builder'
}

export default function ProgramLibraryScreen({
  onSelect, selectedId, onBack, userId, activeSession, initialMode,
}: ProgramLibraryScreenProps) {
  const [userPrograms, setUserPrograms] = useState<UserProgramSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [builderMode, setBuilderMode] = useState<'create' | 'edit' | null>(initialMode === 'builder' ? 'create' : null)
  const [editProgramId, setEditProgramId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [explorerMode, setExplorerMode] = useState(initialMode === 'explorer')

  const ownedTemplateIds = new Set(
    userPrograms.map(p => p.sourceTemplateId).filter((id): id is string => id !== null)
  )

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

  if (explorerMode) {
    return (
      <ProgramExplorerScreen
        ownedTemplateIds={ownedTemplateIds}
        onBack={() => setExplorerMode(false)}
        onAdd={async (programId) => {
          setExplorerMode(false)
          await loadPrograms()
          onSelect?.(programId)
        }}
        userId={userId}
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
            {t.library.title}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="scroll-area" style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* MY PROGRAMS section */}
        <section>
          <div className="section-label" style={{ marginBottom: '10px' }}>{t.library.myProgramsHeader}</div>
          {loading ? (
            <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>{t.library.loading}</p>
          ) : userPrograms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div className="font-display" style={{ fontSize: '1.2rem', letterSpacing: '0.08em', color: 'var(--text-primary)', marginBottom: '6px' }}>
                {t.library.emptyStateHeading}
              </div>
              <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                {t.library.emptyStateBody}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={() => setExplorerMode(true)}
                  className="btn-primary"
                  style={{ width: '100%', fontSize: '0.8rem' }}
                >
                  {t.library.exploreProgramsCta}
                </button>
                {userId && (
                  <button
                    onClick={() => setBuilderMode('create')}
                    className="font-mono"
                    style={{
                      display: 'block', width: '100%', padding: '14px',
                      background: 'none', border: '2px dashed var(--accent)',
                      color: 'var(--accent)', fontSize: '0.7rem', cursor: 'pointer',
                      letterSpacing: '0.1em', borderRadius: '2px', fontWeight: 600,
                    }}
                  >
                    {t.library.buildMyOwnCta}
                  </button>
                )}
              </div>
            </div>
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
                      <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', letterSpacing: '0.08em' }}>{t.library.activeBadge}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    {userId && (
                      <button
                        onClick={() => { setEditProgramId(program.id); setBuilderMode('edit') }}
                        className="font-mono"
                        style={{ fontSize: '0.6rem', padding: '6px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-mid)', cursor: 'pointer', letterSpacing: '0.08em' }}
                      >
                        {t.library.editButton}
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
                          {deleting ? '...' : t.library.deleteConfirmButton}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="font-mono"
                          style={{ fontSize: '0.6rem', padding: '6px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-mid)', cursor: 'pointer', letterSpacing: '0.08em' }}
                        >
                          {t.library.deleteCancelButton}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(program.id)}
                        className="font-mono"
                        style={{ fontSize: '0.6rem', padding: '6px 12px', background: 'none', border: '1px solid var(--rust-border)', borderRadius: '2px', color: 'var(--rust)', cursor: 'pointer', letterSpacing: '0.08em' }}
                      >
                        {t.library.deleteButton}
                      </button>
                    )}
                    {selectedId !== program.id && onSelect && (
                      <button
                        onClick={() => handleSelectProgram(program.id)}
                        className="font-mono"
                        style={{ fontSize: '0.6rem', padding: '6px 12px', background: 'var(--accent)', border: 'none', borderRadius: '2px', color: '#fff', cursor: 'pointer', letterSpacing: '0.08em', marginLeft: 'auto' }}
                      >
                        {t.library.selectButton}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CTAs (shown when user has programs) */}
          {userPrograms.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              <button
                onClick={() => setExplorerMode(true)}
                className="font-mono"
                style={{
                  display: 'block', width: '100%', padding: '14px',
                  background: 'none', border: '2px dashed var(--accent)',
                  color: 'var(--accent)', fontSize: '0.7rem', cursor: 'pointer',
                  letterSpacing: '0.1em', borderRadius: '2px', fontWeight: 600,
                }}
              >
                {t.library.exploreProgramsCta}
              </button>
              {userId && (
                <button
                  onClick={() => setBuilderMode('create')}
                  className="font-mono"
                  style={{
                    display: 'block', width: '100%', padding: '14px',
                    background: 'none', border: '2px dashed var(--accent)',
                    color: 'var(--accent)', fontSize: '0.7rem', cursor: 'pointer',
                    letterSpacing: '0.1em', borderRadius: '2px', fontWeight: 600,
                  }}
                >
                  {t.library.buildMyOwnCta}
                </button>
              )}
            </div>
          )}
        </section>

        <div className="safe-bottom" />
      </div>
    </div>
  )
}
