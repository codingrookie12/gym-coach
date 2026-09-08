'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ALL_EXERCISES } from '@/lib/exerciseLibrary'
import { type Split } from '@/lib/routines'
import { type Program } from '@/lib/programs'
import type { HistorySummary } from '@/lib/supabase.queries'

interface UserProgramSummary {
  id: string
  name: string
  sourceTemplateId: string | null
  style: string | null
  level: string | null
  splitCount: number
  exerciseCount: number
}

interface ExerciseLibraryScreenProps {
  onBack?: () => void
  activeSplit?: Split
  lastSplit?: Split | null
  activeProgramId?: string
  activeProgram?: Program | null
  onSelectProgram?: (programId: string) => void
  onOpenMyPrograms?: () => void
  onOpenExplorer?: () => void
  onOpenBuilder?: () => void
  onOpenProgramLibrary?: () => void
  onEditRoutine?: () => void
  onOpenHistory?: () => void
  onOpenExercises?: (preselectedName?: string) => void
  onOpenCustomExercises?: () => void
  pendingCustomCount?: number
}

// ─── Main hub screen ───────────────────────────────────────────────────────────

export default function ExerciseLibraryScreen({
  onBack,
  activeProgramId,
  activeProgram,
  onSelectProgram,
  onOpenMyPrograms,
  onOpenExplorer,
  onOpenBuilder,
  onOpenProgramLibrary,
  onEditRoutine,
  onOpenHistory,
  onOpenExercises,
  onOpenCustomExercises,
  pendingCustomCount = 0,
}: ExerciseLibraryScreenProps) {
  const t = useTranslations('screens.exerciseLibrary')
  const vocabStyle = useTranslations('vocab.programStyle')
  const vocabLevel = useTranslations('vocab.programLevel')
  const [userPrograms, setUserPrograms] = useState<UserProgramSummary[]>([])
  const [switching, setSwitching] = useState<string | null>(null)
  const [historySummary, setHistorySummary] = useState<HistorySummary | null>(null)

  useEffect(() => {
    fetch('/api/user/programs')
      .then(r => r.json())
      .then(d => setUserPrograms(d.programs ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/history/summary')
      .then(r => r.json())
      .then((d: HistorySummary) => setHistorySummary(d))
      .catch(() => setHistorySummary({ trainedLast7Days: 0, currentStreak: 0, last7Dots: Array(7).fill(false), recentPR: null, recentExerciseNames: [] }))
  }, [])

  const totalCount = ALL_EXERCISES.length

  const dots = historySummary?.last7Dots ?? Array(7).fill(false)
  const trainedOf7 = historySummary?.trainedLast7Days ?? 0
  const streak = historySummary?.currentStreak ?? 0

  return (
    <div className="screen-enter flex flex-col" style={{ height: '100%', background: 'var(--bg)' }}>

      {/* Header */}
      <div
        className="safe-top flex items-center gap-4 px-5"
        style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', padding: '4px', minWidth: '44px', minHeight: '44px' }}
          >
            ←
          </button>
        )}
        <div style={{ flex: 1 }}>
          <span className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
            {t('library')}
          </span>
        </div>
      </div>

      {/* Scrollable hub */}
      <div className="scroll-area" style={{ flex: 1, minHeight: 0 }}>

        {/* ── PROGRAMS SECTION ── */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '14px 20px 0' }}>
            <span className="section-label">{t('programs')}</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', padding: '10px 16px 14px', overflowX: 'auto' }}>
            {userPrograms.map(program => {
              const isActive = program.id === activeProgramId
              const style = isActive ? (activeProgram?.style ?? program.style) : program.style
              const level = isActive ? (activeProgram?.level ?? program.level) : program.level
              const styleColor: Record<string, string> = { hypertrophy: 'var(--accent)', strength: 'var(--rust)', powerlifting: 'var(--rust)', endurance: 'var(--text-mid)' }
              const levelColor: Record<string, string> = { beginner: 'var(--text-secondary)', intermediate: 'var(--text-mid)', advanced: 'var(--text-primary)' }
              return (
                <button
                  key={program.id}
                  disabled={switching !== null}
                  onClick={async () => {
                    if (isActive) return
                    setSwitching(program.id)
                    try {
                      await fetch('/api/user/program', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userProgramId: program.id }),
                      })
                      onSelectProgram?.(program.id)
                    } catch {
                      setSwitching(null)
                    }
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px',
                    minWidth: '170px', padding: '12px 14px', flexShrink: 0,
                    background: 'var(--surface)',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '2px', textAlign: 'left',
                    cursor: isActive ? 'default' : 'pointer',
                    opacity: switching && switching !== program.id ? 0.5 : 1,
                  }}
                >
                  {isActive && (
                    <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--accent)', letterSpacing: '0.1em' }}>{t('active')}</span>
                  )}
                  {switching === program.id && (
                    <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>{t('switching')}</span>
                  )}
                  <span className="font-display" style={{ fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '0.06em', lineHeight: 1 }}>
                    {program.name}
                  </span>
                  {style && (
                    <span className="font-mono" style={{ fontSize: '0.5rem', letterSpacing: '0.08em', color: styleColor[style] ?? 'var(--text-secondary)' }}>
                      {vocabStyle(style)}
                    </span>
                  )}
                  {level && (
                    <span className="font-mono" style={{ fontSize: '0.5rem', letterSpacing: '0.08em', color: levelColor[level] ?? 'var(--text-secondary)' }}>
                      {vocabLevel(level)}
                    </span>
                  )}
                  {!isActive && switching !== program.id && (
                    <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', marginTop: '2px' }}>{t('select')}</span>
                  )}
                </button>
              )
            })}

            {userPrograms.length >= 2 && (
              <button
                onClick={() => (onOpenMyPrograms ?? onOpenProgramLibrary)?.()}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '6px',
                  minWidth: '130px', padding: '12px 14px', flexShrink: 0,
                  background: 'var(--surface)', border: '1px solid var(--border-2)',
                  borderRadius: '2px', textAlign: 'left', cursor: 'pointer',
                }}
              >
                <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-mid)', letterSpacing: '0.08em', lineHeight: 1.4, whiteSpace: 'pre-line' }}>{t('myPrograms')}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>›</span>
              </button>
            )}

            <button
              onClick={() => (onOpenExplorer ?? onOpenProgramLibrary)?.()}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '6px',
                minWidth: '130px', padding: '12px 14px', flexShrink: 0,
                background: 'none', border: '2px dashed var(--accent)',
                borderRadius: '2px', textAlign: 'left', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>+</span>
              <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', letterSpacing: '0.08em', lineHeight: 1.4, whiteSpace: 'pre-line' }}>{t('explorePrograms')}</span>
            </button>

            <button
              onClick={() => (onOpenBuilder ?? onOpenProgramLibrary)?.()}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '6px',
                minWidth: '130px', padding: '12px 14px', flexShrink: 0,
                background: 'none', border: '2px dashed var(--border)',
                borderRadius: '2px', textAlign: 'left', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '1.2rem', color: 'var(--text-mid)' }}>+</span>
              <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-mid)', letterSpacing: '0.08em', lineHeight: 1.4, whiteSpace: 'pre-line' }}>{t('buildMyOwn')}</span>
            </button>
          </div>

          {onEditRoutine && (
            <button
              onClick={onEditRoutine}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                borderTop: '1px solid var(--border)',
                padding: '10px 16px',
                color: 'var(--text-mid)',
                fontFamily: 'Space Mono, monospace',
                fontSize: '0.6rem',
                letterSpacing: '0.1em',
                cursor: 'pointer',
                width: '100%',
                transition: 'color 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-mid)')}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              {t('editRoutine')}
            </button>
          )}
        </div>

        {/* ── HISTORY SECTION ── */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '14px 20px 0' }}>
            <span className="section-label">{t('history')}</span>
          </div>

          <button
            onClick={() => onOpenHistory?.()}
            style={{
              display: 'block',
              width: '100%',
              background: 'none',
              border: 'none',
              padding: '10px 16px 14px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div className="card-accent" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span className="font-display" style={{ fontSize: '1.8rem', color: 'var(--accent)', letterSpacing: '0.04em', lineHeight: 0.9 }}>
                  {trainedOf7}<span style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>/7</span>
                </span>
                <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>
                  {t('daysTrained')}
                </span>
                <div style={{ flex: 1 }} />
                {streak >= 2 && (
                  <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--rust)', letterSpacing: '0.08em' }}>
                    🔥 {streak}{t('daysAbbrev')}
                  </span>
                )}
              </div>

              {/* Mini 7-day dot row */}
              <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }}>
                {dots.map((trained, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: '6px',
                      background: trained ? 'var(--accent)' : 'var(--surface-2)',
                      border: `1px solid ${trained ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: '1px',
                      outline: i === dots.length - 1 ? '1px solid var(--text-mid)' : 'none',
                      outlineOffset: '1px',
                    }}
                  />
                ))}
              </div>

              {historySummary?.recentPR && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span className="tag accent">{t('pr')}</span>
                    <span className="font-body" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {historySummary.recentPR.exerciseName}
                    </span>
                    <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-mid)', letterSpacing: '0.05em' }}>
                      {historySummary.recentPR.weight} {historySummary.recentPR.unit}
                    </span>
                  </div>
                </div>
              )}

              {trainedOf7 === 0 && !historySummary?.recentPR && (
                <div style={{ marginTop: '10px' }}>
                  <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                    {t('noSessionsLoggedYet')}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', letterSpacing: '0.1em' }}>
                  {t('viewProgress')}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* ── EXERCISES SECTION (collapsed entry) ── */}
        <div>
          <div style={{ padding: '14px 20px 0' }}>
            <span className="section-label">{t('exercises')}</span>
          </div>

          {pendingCustomCount > 0 && (
            <div style={{ padding: '8px 16px 0' }}>
              <button
                onClick={() => onOpenCustomExercises?.()}
                style={{
                  width: '100%',
                  background: 'var(--accent-dim)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: '2px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--accent)', letterSpacing: '0.1em' }}>
                    {t('customNeedsMetadata', { count: pendingCustomCount })}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', marginTop: '3px' }}>
                    {t('tapToCompleteHint')}
                  </div>
                </div>
                <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', letterSpacing: '0.1em', flexShrink: 0 }}>→</span>
              </button>
            </div>
          )}

          <div style={{ padding: '10px 16px 20px' }}>
            <button
              onClick={() => onOpenExercises?.()}
              style={{
                display: 'block',
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '2px',
                padding: '14px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: historySummary?.recentExerciseNames.length ? '12px' : 0 }}>
                <div>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
                    {t('total', { count: totalCount })}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginTop: '4px' }}>
                    {t('browseAndSearch')}
                  </div>
                </div>
                <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', letterSpacing: '0.1em' }}>
                  {t('browse')}
                </span>
              </div>

              {historySummary?.recentExerciseNames && historySummary.recentExerciseNames.length > 0 && (
                <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                  <div className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', letterSpacing: '0.12em', marginBottom: '6px' }}>
                    {t('recent')}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {historySummary.recentExerciseNames.map(name => (
                      <span
                        key={name}
                        role="button"
                        tabIndex={0}
                        onClick={e => { e.stopPropagation(); onOpenExercises?.(name) }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onOpenExercises?.(name) } }}
                        className="tag"
                        style={{ cursor: 'pointer' }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </button>
          </div>
        </div>

      </div>

    </div>
  )
}
