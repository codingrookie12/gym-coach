'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  ALL_EXERCISES,
  ExerciseDefinition,
  Equipment,
  Muscle,
  filterExercises,
  getUniqueEquipment,
  getUniqueMuscles,
} from '@/lib/exerciseLibrary'
import { getAllExercisesForProgram, getRoutine, Split } from '@/lib/routines'
import { ACTIVE_PROGRAM, type Program } from '@/lib/programs'
import ExerciseDetailSheet from '@/components/ExerciseDetailSheet'

// ─── Props ─────────────────────────────────────────────────────────────────────

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
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SPLITS: (Split | 'All')[] = ['All', 'Push', 'Pull', 'Legs']
const EQUIPMENT_OPTIONS = getUniqueEquipment()
const MUSCLE_OPTIONS = getUniqueMuscles()


// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'browse' | 'custom'
type SplitFilter = Split | 'All'

// ─── Sub-components ────────────────────────────────────────────────────────────

function SplitChip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--accent)' : 'var(--surface-2)',
        color: active ? '#0C0B09' : 'var(--text-mid)',
        border: active ? '1px solid var(--accent)' : '1px solid var(--border-2)',
        borderRadius: '2px',
        padding: '5px 12px',
        fontFamily: 'Space Mono, monospace',
        fontSize: '0.6rem',
        letterSpacing: '0.1em',
        cursor: 'pointer',
        transition: 'all 0.1s',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {label.toUpperCase()}
    </button>
  )
}

function ExerciseRow({
  exercise,
  inProgram,
  isCustom,
  onTap,
}: {
  exercise: ExerciseDefinition
  inProgram: boolean
  isCustom: boolean
  onTap: (ex: ExerciseDefinition) => void
}) {
  return (
    <button
      onClick={() => onTap(exercise)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 20px',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseDown={e => (e.currentTarget.style.background = 'rgba(212,241,58,0.04)')}
      onMouseUp={e => (e.currentTarget.style.background = 'none')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      onTouchStart={e => (e.currentTarget.style.background = 'rgba(212,241,58,0.04)')}
      onTouchEnd={e => (e.currentTarget.style.background = 'none')}
    >
      {/* Indicator dot */}
      <div style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: inProgram ? 'var(--accent)' : 'var(--border-2)',
        flexShrink: 0,
      }} />

      {/* Name + tags */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="font-body"
          style={{
            fontSize: '0.95rem',
            color: 'var(--text-primary)',
            fontWeight: 500,
            lineHeight: 1.3,
            marginBottom: '4px',
          }}
        >
          {exercise.name}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span className="tag">{exercise.equipment}</span>
          {exercise.primaryMuscles.slice(0, 2).map(m => (
            <span key={m} className="tag">{m}</span>
          ))}
          {isCustom && <span className="tag accent">Custom</span>}
          {inProgram && <span className="tag accent">In Program</span>}
        </div>
      </div>

      {/* Mechanic badge */}
      {exercise.mechanic && (
        <span
          className="font-mono"
          style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', flexShrink: 0 }}
        >
          {exercise.mechanic.toUpperCase()}
        </span>
      )}
    </button>
  )
}

// ─── Program detail sheet ───────────────────────────────────────────────────────

function ProgramDetailSheet({ onClose }: { onClose: () => void }) {
  const program = ACTIVE_PROGRAM
  const splitData = program.splits.map(split => ({
    split,
    exercises: getRoutine(split),
  }))

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 40, animation: 'fadeIn 0.15s ease',
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          borderRadius: '8px 8px 0 0',
          zIndex: 50,
          animation: 'slideUp 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
          maxHeight: '80dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-2)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '4px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <h2 className="font-display" style={{ fontSize: '1.4rem', color: 'var(--text-primary)', letterSpacing: '0.04em', margin: 0, lineHeight: 1.1 }}>
                {program.name.toUpperCase()}
              </h2>
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span className="tag">Tier {program.tier}</span>
                <span className="tag" style={{ textTransform: 'capitalize' }}>{program.style}</span>
                <span className="tag">{program.daysPerWeek}x / week</span>
                <span className="tag" style={{ textTransform: 'capitalize' }}>{program.level}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px', flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="scroll-area" style={{ flex: 1, padding: '0 0 32px' }}>
          {splitData.map(({ split, exercises }) => (
            <div key={split}>
              {/* Split header */}
              <div style={{
                padding: '12px 20px 10px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                position: 'sticky',
                top: 0,
                zIndex: 5,
              }}>
                <span className="section-label">{split.toUpperCase()} DAY</span>
                <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--border-2)', marginLeft: '8px' }}>
                  {exercises.length} EXERCISES
                </span>
              </div>
              {/* Exercise rows */}
              {exercises.map(ex => (
                <div
                  key={ex.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border)',
                    gap: '12px',
                  }}
                >
                  <span className="font-body" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', flex: 1 }}>
                    {ex.name}
                  </span>
                  <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.06em', flexShrink: 0 }}>
                    {ex.sets}×{ex.repRange[0]}–{ex.repRange[1]}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Browse Tab ────────────────────────────────────────────────────────────────

function BrowseTab({
  onSelectExercise,
  programExerciseNames,
}: {
  onSelectExercise: (ex: ExerciseDefinition) => void
  programExerciseNames: Set<string>
}) {
  const [query, setQuery] = useState('')
  const [splitFilter, setSplitFilter] = useState<SplitFilter>('All')
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | 'All'>('All')
  const [muscleFilter, setMuscleFilter] = useState<string>('All')
  const [showFilters, setShowFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    return filterExercises({
      query: query || undefined,
      split: splitFilter === 'All' ? undefined : splitFilter,
      equipment: equipmentFilter === 'All' ? undefined : equipmentFilter,
      muscle: muscleFilter === 'All' ? undefined : muscleFilter,
    })
  }, [query, splitFilter, equipmentFilter, muscleFilter])

  const activeFilterCount = [
    splitFilter !== 'All',
    equipmentFilter !== 'All',
    muscleFilter !== 'All',
  ].filter(Boolean).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Search bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <svg
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
              pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search exercises..."
            className="input-field"
            style={{ paddingLeft: '36px', paddingRight: query ? '36px' : '12px' }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: '1rem', padding: '0', lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter row */}
      <div style={{ flexShrink: 0 }}>
        {/* Quick split chips */}
        <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>
          {SPLITS.map(s => (
            <SplitChip key={s} label={s} active={splitFilter === s} onClick={() => setSplitFilter(s)} />
          ))}
          <div style={{ flexShrink: 0, width: '1px', background: 'var(--border-2)', margin: '0 4px' }} />
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              background: activeFilterCount > 0 ? 'var(--accent-dim)' : 'var(--surface-2)',
              color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-mid)',
              border: activeFilterCount > 0 ? '1px solid var(--accent-border)' : '1px solid var(--border-2)',
              borderRadius: '2px',
              padding: '5px 12px',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.6rem',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            FILTER
            {activeFilterCount > 0 && (
              <span style={{
                background: 'var(--accent)', color: '#0C0B09',
                borderRadius: '50%', width: '14px', height: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.5rem', fontWeight: 700,
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Expanded filter panel */}
        {showFilters && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Equipment */}
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>Equipment</div>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                <SplitChip label="All" active={equipmentFilter === 'All'} onClick={() => setEquipmentFilter('All')} />
                {EQUIPMENT_OPTIONS.map(eq => (
                  <SplitChip key={eq} label={eq} active={equipmentFilter === eq} onClick={() => setEquipmentFilter(eq)} />
                ))}
              </div>
            </div>

            {/* Muscle */}
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>Primary Muscle</div>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                <SplitChip label="All" active={muscleFilter === 'All'} onClick={() => setMuscleFilter('All')} />
                {MUSCLE_OPTIONS.map(m => (
                  <SplitChip key={m} label={m} active={muscleFilter === m} onClick={() => setMuscleFilter(m)} />
                ))}
              </div>
            </div>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setSplitFilter('All'); setEquipmentFilter('All'); setMuscleFilter('All') }}
                style={{ background: 'none', border: '1px solid var(--rust-border)', color: 'var(--rust)', borderRadius: '2px', padding: '7px 12px', fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', cursor: 'pointer', letterSpacing: '0.08em', alignSelf: 'flex-start' }}
              >
                CLEAR FILTERS
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results count */}
      <div style={{ padding: '8px 16px', flexShrink: 0 }}>
        <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
          {results.length} EXERCISE{results.length !== 1 ? 'S' : ''}
          {query && ` · "${query}"`}
        </span>
      </div>

      {/* Results list */}
      <div className="scroll-area" style={{ flex: 1, minHeight: 0 }}>
        {results.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: '8px' }}>
              NO RESULTS
            </div>
            <div className="font-body" style={{ fontSize: '0.85rem', color: 'var(--border-2)' }}>
              Try adjusting your search or filters
            </div>
          </div>
        ) : (
          results.map(ex => (
            <ExerciseRow
              key={ex.id}
              exercise={ex}
              inProgram={programExerciseNames.has(ex.name)}
              isCustom={ex.isCustom}
              onTap={onSelectExercise}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ExerciseLibraryScreen({
  onBack,
  activeSplit,
  lastSplit,
  activeProgramId = 'ppl-default',
  activeProgram,
  onSelectProgram,
  onOpenMyPrograms,
  onOpenExplorer,
  onOpenBuilder,
  onOpenProgramLibrary,
  onEditRoutine,
}: ExerciseLibraryScreenProps) {
  const [tab, setTab] = useState<Tab>('browse')
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDefinition | null>(null)
  const [showProgramDetail, setShowProgramDetail] = useState(false)
  const [userPrograms, setUserPrograms] = useState<UserProgramSummary[]>([])
  const [switching, setSwitching] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/user/programs')
      .then(r => r.json())
      .then(d => setUserPrograms(d.programs ?? []))
      .catch(() => {})
  }, [])

  const totalCount = ALL_EXERCISES.length
  const customExercises = ALL_EXERCISES.filter(e => e.isCustom)

  const programExerciseNames = useMemo(
    () => new Set(getAllExercisesForProgram(activeProgramId).map(e => e.name)),
    [activeProgramId]
  )

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
            style={{ background: 'none', border: 'none', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', padding: '4px' }}
          >
            ←
          </button>
        )}
        <div style={{ flex: 1 }}>
          <span className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
            LIBRARY
          </span>
        </div>
        <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
          {totalCount} TOTAL
        </span>
      </div>

      {/* ── PROGRAMS SECTION ── */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '10px 20px 0' }}>
          <span className="section-label">MY PROGRAM</span>
        </div>

        {/* Carousel: user programs + action cards */}
        <div style={{ display: 'flex', gap: '10px', padding: '10px 16px 14px', overflowX: 'auto' }}>
          {/* User program cards */}
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
                  <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--accent)', letterSpacing: '0.1em' }}>ACTIVE</span>
                )}
                {switching === program.id && (
                  <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>SWITCHING...</span>
                )}
                <span className="font-display" style={{ fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '0.06em', lineHeight: 1 }}>
                  {program.name}
                </span>
                {style && (
                  <span className="font-mono" style={{ fontSize: '0.5rem', letterSpacing: '0.08em', color: styleColor[style] ?? 'var(--text-secondary)' }}>
                    {style.toUpperCase()}
                  </span>
                )}
                {level && (
                  <span className="font-mono" style={{ fontSize: '0.5rem', letterSpacing: '0.08em', color: levelColor[level] ?? 'var(--text-secondary)' }}>
                    {level.toUpperCase()}
                  </span>
                )}
                {!isActive && switching !== program.id && (
                  <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', marginTop: '2px' }}>SELECT →</span>
                )}
              </button>
            )
          })}

          {/* MY PROGRAMS card — only when user has 2+ programs */}
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
              <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-mid)', letterSpacing: '0.08em', lineHeight: 1.4 }}>MY{'\n'}PROGRAMS</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>›</span>
            </button>
          )}

          {/* EXPLORE PROGRAMS action card */}
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
            <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', letterSpacing: '0.08em', lineHeight: 1.4 }}>EXPLORE{'\n'}PROGRAMS</span>
          </button>

          {/* BUILD MY OWN action card */}
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
            <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-mid)', letterSpacing: '0.08em', lineHeight: 1.4 }}>BUILD{'\n'}MY OWN</span>
          </button>
        </div>

        {/* Edit Routine link */}
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
            EDIT ROUTINE
          </button>
        )}
      </div>

      {/* ── EXERCISES SECTION ── */}

      {/* Section divider label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 20px',
        flexShrink: 0,
      }}>
        <span className="section-label" style={{ padding: '10px 0 0', flexShrink: 0 }}>EXERCISES</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)', marginTop: '10px' }} />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {([
          { id: 'browse' as Tab, label: 'BROWSE' },
          { id: 'custom' as Tab, label: 'CUSTOM', count: customExercises.length },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '12px 8px 10px',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.58rem',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'color 0.1s, border-color 0.1s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{
                background: tab === t.id ? 'var(--accent)' : 'var(--surface-2)',
                color: tab === t.id ? '#0C0B09' : 'var(--text-secondary)',
                borderRadius: '2px',
                padding: '1px 5px',
                fontSize: '0.5rem',
                fontWeight: 700,
                transition: 'all 0.1s',
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'browse' && (
        <BrowseTab onSelectExercise={setSelectedExercise} programExerciseNames={programExerciseNames} />
      )}

      {tab === 'custom' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="scroll-area" style={{ flex: 1, minHeight: 0 }}>
            {customExercises.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <div className="font-display" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: '6px' }}>
                  NO CUSTOM EXERCISES
                </div>
                <div className="font-body" style={{ fontSize: '0.85rem', color: 'var(--border-2)' }}>
                  Custom exercises added to your profile appear here
                </div>
              </div>
            ) : (
              customExercises.map(ex => (
                <ExerciseRow
                  key={ex.id}
                  exercise={ex}
                  inProgram={programExerciseNames.has(ex.name)}
                  isCustom={true}
                  onTap={setSelectedExercise}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Exercise detail sheet */}
      {selectedExercise && (
        <ExerciseDetailSheet
          exercise={selectedExercise}
          inProgram={programExerciseNames.has(selectedExercise.name)}
          onClose={() => setSelectedExercise(null)}
        />
      )}

      {/* Program detail sheet */}
      {showProgramDetail && (
        <ProgramDetailSheet onClose={() => setShowProgramDetail(false)} />
      )}

    </div>
  )
}
